import { ShortcutRegistry } from '@/core/shortcuts';

describe('ShortcutRegistry', () => {
  let registry: ShortcutRegistry;
  let actionCalled: boolean;

  const mockAction = () => { actionCalled = true; };

  beforeEach(() => {
    registry = new ShortcutRegistry();
    actionCalled = false;
  });

  it('should register and retrieve shortcuts', () => {
    registry.register({
      id: 'test',
      label: 'Test',
      description: 'Test shortcut',
      binding: { key: 'k', ctrl: true },
      action: mockAction,
    });

    expect(registry.get('test')).toBeDefined();
    expect(registry.get('test')!.label).toBe('Test');
  });

  it('should unregister shortcuts', () => {
    registry.register({
      id: 'test',
      label: 'Test',
      description: 'Test',
      binding: { key: 'k', ctrl: true },
      action: mockAction,
    });

    expect(registry.unregister('test')).toBe(true);
    expect(registry.get('test')).toBeUndefined();
    expect(registry.unregister('nonexistent')).toBe(false);
  });

  it('should detect binding conflicts', () => {
    registry.register({
      id: 'a',
      label: 'A',
      description: 'A',
      binding: { key: 'k', ctrl: true },
      action: mockAction,
    });

    expect(() =>
      registry.register({
        id: 'b',
        label: 'B',
        description: 'B',
        binding: { key: 'k', ctrl: true },
        action: mockAction,
      }),
    ).toThrow('Shortcut binding conflict');
  });

  it('should allow re-registering same id with same binding', () => {
    const def = {
      id: 'test',
      label: 'Test',
      description: 'Test',
      binding: { key: 'k', ctrl: true },
      action: mockAction,
    };
    registry.register(def);
    expect(() => registry.register(def)).not.toThrow();
  });

  it('should find shortcut by binding', () => {
    registry.register({
      id: 'find-me',
      label: 'Find',
      description: 'Find',
      binding: { key: 's', ctrl: true },
      action: mockAction,
    });

    const found = registry.findByBinding({ key: 's', ctrl: true });
    expect(found).toBeDefined();
    expect(found!.id).toBe('find-me');
  });

  it('should list all shortcuts', () => {
    registry.register({
      id: 'a',
      label: 'A',
      description: 'A',
      binding: { key: 'a' },
      action: mockAction,
    });
    registry.register({
      id: 'b',
      label: 'B',
      description: 'B',
      binding: { key: 'b' },
      action: mockAction,
      category: 'nav',
    });

    expect(registry.getAll()).toHaveLength(2);
    expect(registry.getByCategory('nav')).toHaveLength(1);
  });

  it('should handle key events', () => {
    registry.register({
      id: 'test',
      label: 'Test',
      description: 'Test',
      binding: { key: 'k', ctrl: true },
      action: mockAction,
    });

    const handled = registry.handleKeyEvent({
      key: 'k',
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
    });

    expect(handled).toBe(true);
    expect(actionCalled).toBe(true);
  });

  it('should not handle unregistered key events', () => {
    const handled = registry.handleKeyEvent({
      key: 'x',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
    });
    expect(handled).toBe(false);
  });

  it('should respect enabled flag', () => {
    registry.register({
      id: 'test',
      label: 'Test',
      description: 'Test',
      binding: { key: 'k' },
      action: mockAction,
    });

    registry.setEnabled('test', false);

    const handled = registry.handleKeyEvent({
      key: 'k',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
    });

    expect(handled).toBe(false);
    expect(actionCalled).toBe(false);
  });
});
