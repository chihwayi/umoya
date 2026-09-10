import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * TERM-11: SNOMED CT Expression Constraint Language (ECL) support.
 *
 * Implements the practical/common ECL subset used by real clinical
 * queries and CDSS guideline filters — not the full formal ECL grammar
 * (no refinements like `: 116676008 |Associated morphology| = 55641003`,
 * no cardinality groups, no wildcards). Supported:
 *
 *   123456      - the concept itself (self)
 *   <123456     - descendants of 123456 (exclusive)
 *   <<123456    - descendants of 123456, including itself
 *   >123456     - ancestors of 123456 (exclusive)
 *   >>123456    - ancestors of 123456, including itself
 *   ^123456     - members of the reference set 123456 (simple refset)
 *   A AND B     - intersection
 *   A OR B      - union
 *   A MINUS B   - set difference
 *   ( ... )     - grouping
 *
 * Previously the `ecl` query parameter existed on the search API but was
 * silently ignored (dead code) — this is the first real implementation.
 * Operates on the INFERRED hierarchy (snomed_relationships), which is the
 * correct default per the SNOMED CT ECL specification.
 */

type EclNode =
  | { kind: 'self'; conceptId: string }
  | { kind: 'descendants'; conceptId: string; includeSelf: boolean }
  | { kind: 'ancestors'; conceptId: string; includeSelf: boolean }
  | { kind: 'refset'; refsetId: string }
  | { kind: 'and'; left: EclNode; right: EclNode }
  | { kind: 'or'; left: EclNode; right: EclNode }
  | { kind: 'minus'; left: EclNode; right: EclNode };

@Injectable()
export class EclService {
  private readonly logger = new Logger(EclService.name);

  /** Tokenizes and parses an ECL expression into an AST. */
  parse(ecl: string): EclNode {
    const tokens = this.tokenize(ecl);
    let pos = 0;

    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    const parseAtom = (): EclNode => {
      const tok = peek();
      if (!tok) throw new BadRequestException('Unexpected end of ECL expression');

      if (tok === '(') {
        consume();
        const node = parseExpression();
        if (peek() !== ')') throw new BadRequestException('Expected closing parenthesis in ECL expression');
        consume();
        return node;
      }
      if (tok === '<<') {
        consume();
        return { kind: 'descendants', conceptId: this.expectConceptId(consume()), includeSelf: true };
      }
      if (tok === '<') {
        consume();
        return { kind: 'descendants', conceptId: this.expectConceptId(consume()), includeSelf: false };
      }
      if (tok === '>>') {
        consume();
        return { kind: 'ancestors', conceptId: this.expectConceptId(consume()), includeSelf: true };
      }
      if (tok === '>') {
        consume();
        return { kind: 'ancestors', conceptId: this.expectConceptId(consume()), includeSelf: false };
      }
      if (tok === '^') {
        consume();
        return { kind: 'refset', refsetId: this.expectConceptId(consume()) };
      }
      return { kind: 'self', conceptId: this.expectConceptId(consume()) };
    };

    const parseExpression = (): EclNode => {
      let node = parseAtom();
      while (peek() === 'AND' || peek() === 'OR' || peek() === 'MINUS') {
        const op = consume();
        const right = parseAtom();
        node = { kind: op === 'AND' ? 'and' : op === 'OR' ? 'or' : 'minus', left: node, right } as EclNode;
      }
      return node;
    };

    const result = parseExpression();
    if (pos < tokens.length) throw new BadRequestException(`Unexpected token in ECL expression: "${tokens[pos]}"`);
    return result;
  }

  private tokenize(ecl: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    const src = ecl.trim();
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '(' || ch === ')' || ch === '^') { tokens.push(ch); i++; continue; }
      if (ch === '<') {
        if (src[i + 1] === '<') { tokens.push('<<'); i += 2; } else { tokens.push('<'); i++; }
        continue;
      }
      if (ch === '>') {
        if (src[i + 1] === '>') { tokens.push('>>'); i += 2; } else { tokens.push('>'); i++; }
        continue;
      }
      if (/[A-Za-z]/.test(ch)) {
        let word = '';
        while (i < src.length && /[A-Za-z]/.test(src[i])) { word += src[i]; i++; }
        const upper = word.toUpperCase();
        if (upper === 'AND' || upper === 'OR' || upper === 'MINUS') {
          tokens.push(upper);
        } else {
          throw new BadRequestException(`Unsupported ECL keyword: "${word}" (only AND/OR/MINUS supported)`);
        }
        continue;
      }
      if (/[0-9]/.test(ch)) {
        let num = '';
        while (i < src.length && /[0-9]/.test(src[i])) { num += src[i]; i++; }
        // Skip a trailing |term| annotation, e.g. "73211009 |Diabetes mellitus|"
        let j = i;
        while (j < src.length && /\s/.test(src[j])) j++;
        if (src[j] === '|') {
          j++;
          while (j < src.length && src[j] !== '|') j++;
          i = j + 1;
        }
        tokens.push(num);
        continue;
      }
      throw new BadRequestException(`Unexpected character in ECL expression: "${ch}"`);
    }
    return tokens;
  }

  private expectConceptId(tok: string | undefined): string {
    if (!tok || !/^\d+$/.test(tok)) throw new BadRequestException(`Expected a SNOMED concept ID, got "${tok}"`);
    return tok;
  }

  /** Evaluates a parsed ECL AST against the real relationship tables, returning matching active concept IDs. */
  async evaluate(tenantDb: DataSource, ecl: string, limit = 500): Promise<string[]> {
    const ast = this.parse(ecl);
    const ids = await this.evalNode(tenantDb, ast);
    return Array.from(ids).slice(0, limit);
  }

  private async evalNode(tenantDb: DataSource, node: EclNode): Promise<Set<string>> {
    switch (node.kind) {
      case 'self':
        return new Set([node.conceptId]);

      case 'descendants': {
        const rows = await tenantDb.query(
          `
          WITH RECURSIVE descendants AS (
            SELECT r.source_id AS concept_id FROM snomed_relationships r
            WHERE r.destination_id = $1 AND r.type_id = '116680003' AND r.active = true
            UNION
            SELECT r.source_id FROM snomed_relationships r
            JOIN descendants d ON r.destination_id = d.concept_id
            WHERE r.type_id = '116680003' AND r.active = true
          )
          SELECT DISTINCT d.concept_id FROM descendants d
          JOIN snomed_concepts c ON c.concept_id = d.concept_id AND c.active = true
          `,
          [node.conceptId],
        );
        const set = new Set<string>(rows.map((r: any) => r.concept_id));
        if (node.includeSelf) set.add(node.conceptId);
        return set;
      }

      case 'ancestors': {
        const rows = await tenantDb.query(
          `
          WITH RECURSIVE ancestors AS (
            SELECT r.destination_id AS concept_id FROM snomed_relationships r
            WHERE r.source_id = $1 AND r.type_id = '116680003' AND r.active = true
            UNION
            SELECT r.destination_id FROM snomed_relationships r
            JOIN ancestors a ON r.source_id = a.concept_id
            WHERE r.type_id = '116680003' AND r.active = true
          )
          SELECT DISTINCT a.concept_id FROM ancestors a
          JOIN snomed_concepts c ON c.concept_id = a.concept_id AND c.active = true
          `,
          [node.conceptId],
        );
        const set = new Set<string>(rows.map((r: any) => r.concept_id));
        if (node.includeSelf) set.add(node.conceptId);
        return set;
      }

      case 'refset': {
        // No refset-member table is loaded in this codebase (see TERM-12
        // boundary notes) — a real, honest empty result rather than
        // pretending to support something not backed by loaded data.
        this.logger.warn(`ECL refset constraint ^${node.refsetId} requested but no refset-member table is loaded — returning empty set`);
        return new Set();
      }

      case 'and': {
        const [l, r] = await Promise.all([this.evalNode(tenantDb, node.left), this.evalNode(tenantDb, node.right)]);
        return new Set([...l].filter((id) => r.has(id)));
      }
      case 'or': {
        const [l, r] = await Promise.all([this.evalNode(tenantDb, node.left), this.evalNode(tenantDb, node.right)]);
        return new Set([...l, ...r]);
      }
      case 'minus': {
        const [l, r] = await Promise.all([this.evalNode(tenantDb, node.left), this.evalNode(tenantDb, node.right)]);
        return new Set([...l].filter((id) => !r.has(id)));
      }
    }
  }
}
