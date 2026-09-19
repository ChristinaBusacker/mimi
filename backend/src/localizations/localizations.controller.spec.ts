import { Test, TestingModule } from '@nestjs/testing';
import { LocalizationsController } from './localizations.controller';

describe('LocalizationsController', () => {
  let controller: LocalizationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocalizationsController],
    }).compile();

    controller = module.get<LocalizationsController>(LocalizationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
