"""
Train the denial prediction model from historical claims data.
Run once to bootstrap the model, then retrain monthly via nightly job.

Usage:
  python scripts/train-denial-prediction-model.py \
    --db-dsn "postgresql://user:pass@localhost:5432/clinic_demo_db" \
    --output /models/denial_prediction.pkl
"""
import argparse
import pickle
import psycopg2
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, classification_report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-dsn", required=True)
    parser.add_argument("--output", default="/models/denial_prediction.pkl")
    args = parser.parse_args()

    conn = psycopg2.connect(args.db_dsn)
    df = pd.read_sql(
        """
        SELECT
            crs.risk_score,
            crs.feature_snapshot,
            crs.actual_outcome
        FROM claim_risk_scores crs
        WHERE crs.actual_outcome IS NOT NULL
        """,
        conn,
    )
    conn.close()

    if len(df) < 100:
        print(f"Only {len(df)} labeled samples — need 100+ to train. Exiting.")
        return

    features_df = pd.json_normalize(df["feature_snapshot"])
    y = (df["actual_outcome"] == "denied").astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        features_df, y, test_size=0.2, random_state=42
    )

    model = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=4,
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred_proba = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_pred_proba)
    print(f"AUC-ROC: {auc:.4f}")
    print(classification_report(y_test, (y_pred_proba > 0.5).astype(int)))

    with open(args.output, "wb") as f:
        pickle.dump(model, f)
    print(f"Model saved to {args.output}")


if __name__ == "__main__":
    main()
