import { Module } from '@nestjs/common';

import { DataTransferController } from './data-transfer.controller';
import { DataTransferService } from './data-transfer.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [DataTransferController],
  providers: [DataTransferService],
  exports: [DataTransferService],
  imports: [AuthModule],
})
export class DataTransferModule {}
