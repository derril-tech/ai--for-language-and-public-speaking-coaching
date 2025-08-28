import { Module } from '@nestjs/common';
import { AppController } from './routes';

@Module({
  imports: [],
  controllers: [AppController],
  providers: []
})
export class AppModule {}

