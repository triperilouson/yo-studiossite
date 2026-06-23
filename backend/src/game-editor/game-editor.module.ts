import { Module } from '@nestjs/common';
import { AdminGameEditorController } from './admin-game-editor.controller';
import { GameAssetsController } from './game-assets.controller';
import { GameEditorService } from './game-editor.service';

@Module({
  controllers: [AdminGameEditorController, GameAssetsController],
  providers: [GameEditorService],
  exports: [GameEditorService],
})
export class GameEditorModule {}
