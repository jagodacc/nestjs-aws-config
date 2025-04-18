<p align="center">
  <a href="https://nestjs.com/" target="blank">
    <img src="https://nestjs.com/img/logo_text.svg" width="320" alt="Nest Logo" />
  </a>
</p>

<p align="center">
    A NestJS module for retrieving configuration from AWS AppConfig based on rxjs.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@jagodacc/nestjs-aws-config"><img src="https://img.shields.io/npm/v/@jagodacc/nestjs-aws-config.svg" alt="NPM Version" /></a>
  <a href="https://github.com/jagodacc/nestjs-aws-config?tab=Apache-2.0-1-ov-file"><img src="https://img.shields.io/npm/l/@jagodacc/nestjs-aws-config.svg" alt="Package License" /></a>
  <a href="https://www.npmjs.com/package/@jagodacc/nestjs-aws-config"><img src="https://img.shields.io/npm/dm/@jagodacc/nestjs-aws-config.svg" alt="NPM Downloads" /></a>
</p>

## Installation

```sh
npm install --save @jagodacc/nestjs-aws-config
```

## Usage

### Module initialization

```typescript
import { ConfigModule, ConfigModuleOptionsInterface } from '@jagodacc/nestjs-aws-config';
import { Global, Logger, MiddlewareConsumer, Module, NestModule, OnApplicationBootstrap } from '@nestjs/common';

@Module({
    imports: [
        ConfigModule.forRootAsync({
            useFactory: (): ConfigModuleOptionsInterface => {
                for (const env of ['AWS_APP_CONFIG_APPLICATION_ID', 'AWS_APP_CONFIG_PROFILE_ID', 'AWS_APP_CONFIG_ENVIRONMENT_ID']) {
                    if (!process.env[env]) {
                        throw new Error(`Missing environment variable: ${env}`);
                    }
                }

                return {
                    applicationId: process.env.AWS_APP_CONFIG_APPLICATION_ID!,
                    profileId: process.env.AWS_APP_CONFIG_PROFILE_ID!,
                    environmentId: process.env.AWS_APP_CONFIG_ENVIRONMENT_ID!
                };
            }
        })
    ]
})
export class AppModule {}
```

### Configuration subscription retrieval

Subscribing to configuration updates allows changes to be applied without restarting the application.

```typescript
import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@jagodacc/nestjs-aws-config';
import { AppConfigInterface } from '../interfaces';

@Injectable()
export class ExampleService implements OnApplicationBootstrap {
    private appConfig!: AppConfigInterface;

    constructor(private readonly configService: ConfigService<AppConfigInterface>) {}

    public onApplicationBootstrap(): Promise<void> {
        return new Promise<void>(resolve => {
            this.configService.asObservable().subscribe((value) => {
                this.appConfig = value;

                resolve();
            });
        });
    }
}
```

### Configuration asynchronously retrieval

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@jagodacc/nestjs-aws-config';

@Injectable()
export class ExampleService {
    constructor(private readonly configService: ConfigService) {}

    public async getConfig(): Promise<void> {
        const config = await this.configService.getValueAsync();

        console.log(config);
    }
}
```
