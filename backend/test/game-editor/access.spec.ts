import { Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';
import { AdminGameEditorController } from '../../src/game-editor/admin-game-editor.controller';

describe('game editor access', () => {
  it('requires SUPER_ADMIN for every admin editor route', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminGameEditorController)).toEqual([
      Role.SUPER_ADMIN,
    ]);
  });
});
