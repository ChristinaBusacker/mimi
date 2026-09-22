import { Module } from '@nestjs/common';

import { IntegrationsModule } from '../integrations/integrations.module';
import { GamingController } from './gaming.controller';
import { GamingService } from './gaming.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [GamingController],
  providers: [GamingService],
})
export class GamingModule {}
