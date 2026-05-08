import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TenantModuleRoute } from './TenantModuleRoute';

const enabledModules = ['finance', 'nurse_general', 'radiology', 'hiv'];

describe('TenantModuleRoute', () => {
  it('renders children when module is enabled', () => {
    render(
      <MemoryRouter>
        <TenantModuleRoute moduleKey="radiology" enabledModules={enabledModules}>
          <div>Radiology content</div>
        </TenantModuleRoute>
      </MemoryRouter>
    );
    expect(screen.getByText('Radiology content')).toBeTruthy();
  });

  it('redirects when module is not enabled', () => {
    render(
      <MemoryRouter initialEntries={['/operating-room']}>
        <TenantModuleRoute moduleKey="operating_room" enabledModules={enabledModules} redirectTo="/unavailable">
          <div>OR content</div>
        </TenantModuleRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText('OR content')).toBeNull();
  });

  it('renders children when moduleKey is not restricted (core module)', () => {
    render(
      <MemoryRouter>
        <TenantModuleRoute moduleKey="finance" enabledModules={enabledModules}>
          <div>Finance content</div>
        </TenantModuleRoute>
      </MemoryRouter>
    );
    expect(screen.getByText('Finance content')).toBeTruthy();
  });
});
