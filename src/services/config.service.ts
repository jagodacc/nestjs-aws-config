import { AppConfigDataClient, GetLatestConfigurationCommand, StartConfigurationSessionCommand } from '@aws-sdk/client-appconfigdata';
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { Uint8ArrayBlobAdapter } from '@smithy/util-stream/dist-types';
import { BehaviorSubject } from 'rxjs';
import { CONFIG_MODULE_OPTIONS } from '../consts';
import type { ConfigModuleOptionsInterface } from '../interfaces/config-module-options.interface';

@Injectable()
export class ConfigService<T = unknown> extends BehaviorSubject<T> implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ConfigService.name);

    private readonly client: AppConfigDataClient;

    private initialized = false;

    private configurationSessionToken?: string;

    private scheduler?: NodeJS.Timeout;

    constructor(
        @Inject(CONFIG_MODULE_OPTIONS) private readonly options: ConfigModuleOptionsInterface
    ) {
        super(null as T);

        this.client = new AppConfigDataClient(options.aws ?? {});
    }

    public async getValueAsync(): Promise<T> {
        await this.getConfiguration();

        return new Promise<T>((resolve) => {
            this.subscribe((value) => {
                if (value) {
                    resolve(value);
                }
            });
        });
    }

    private async initSession(): Promise<void> {
        if (this.initialized) {
            return;
        }

        this.logger.log('Initializing configuration session');
        this.initialized = true;

        const command = new StartConfigurationSessionCommand({
            ConfigurationProfileIdentifier: this.options.profileId,
            ApplicationIdentifier: this.options.applicationId,
            EnvironmentIdentifier: this.options.environmentId
        });

        const result = await this.client.send(command);

        if (!result.InitialConfigurationToken) {
            throw new Error('Failed to get configuration token');
        }

        this.configurationSessionToken = result.InitialConfigurationToken;
    }

    private async getConfiguration(): Promise<void> {
        this.logger.debug('Getting configuration');

        if (!this.configurationSessionToken) {
            await this.initSession();
        }

        const command = new GetLatestConfigurationCommand({
            ConfigurationToken: this.configurationSessionToken
        });

        const result = await this.client.send(command);

        if (!result.$metadata.httpStatusCode || result.$metadata.httpStatusCode !== 200) {
            throw new Error('Failed to get configuration');
        }

        if (result.ContentType !== 'application/json') {
            throw new Error('Invalid content type');
        }

        if (!result.NextPollConfigurationToken) {
            throw new Error('Failed to get next poll configuration token');
        }

        if (!result.Configuration) {
            throw new Error('Failed to get configuration');
        }

        this.propagateConfiguration(result.Configuration);
        this.logger.debug('Configuration updated successfully');

        this.configurationSessionToken = result.NextPollConfigurationToken;
        this.scheduler = setTimeout(this.getConfiguration.bind(this), (result.NextPollIntervalInSeconds ?? 60) * 1000);
    }

    private propagateConfiguration(data: Uint8ArrayBlobAdapter): void {
        const value = data.transformToString();

        if (!value) {
            if (this.getValue()) {
                this.logger.debug('Skipping configuration update because configuration is not changed');

                return;
            }

            throw new Error('Empty configuration');
        }

        this.next(JSON.parse(value) as T);
    }

    public async onModuleInit(): Promise<void> {
        await this.getConfiguration();

        this.logger.log('Configuration initialized successfully');
    }

    public onModuleDestroy(): void {
        super.unsubscribe();

        if (this.scheduler) {
            clearTimeout(this.scheduler);
        }
    }
}
