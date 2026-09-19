import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntry } from './entities/user.entry';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntry]),
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}