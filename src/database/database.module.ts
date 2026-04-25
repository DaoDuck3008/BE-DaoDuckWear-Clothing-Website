import { Module, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');
        const logger = new Logger('Database');

        if (!uri) {
          logger.error('Missing MONGODB_URI in environment variables');
          throw new Error('Missing MONGODB_URI');
        }

        return {
          uri,
          connectionFactory: (connection: any) => {
            connection.on('connected', () => {
              logger.log('MongoDB connected successfully');
            });
            connection.on('error', (error: any) => {
              logger.error(`MongoDB connection failed: ${error.message}`);
            });
            connection.on('disconnected', () => {
              logger.warn('MongoDB disconnected');
            });
            return connection;
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
