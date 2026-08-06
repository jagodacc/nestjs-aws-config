import {
    AppConfigDataClient,
    GetLatestConfigurationCommand,
    StartConfigurationSessionCommand
} from '@aws-sdk/client-appconfigdata';
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { BehaviorSubject, filter, firstValueFrom, take } from 'rxjs';
import {
    CONFIG_MODULE_OPTIONS,
    DEFAULT_FALLBACK_POLL_INTERVAL_IN_SECONDS,
    MAX_FALLBACK_POLL_INTERVAL_IN_SECONDS,
    MIN_FALLBACK_POLL_INTERVAL_IN_SECONDS
} from '../consts';
import { AwsConfigError } from '../errors';
import type { ConfigurationPayload, ConfigModuleOptionsInterface } from '../interfaces';
import { clamp } from '../utils';

@Injectable()
export class ConfigService<T = unknown> extends BehaviorSubject<T> implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ConfigService.name);

    private readonly fallbackPollIntervalInSeconds: number;

    private readonly client: AppConfigDataClient;

    private configurationSessionToken?: string;

    private scheduler?: NodeJS.Timeout;

    private initSessionPromise?: Promise<void>;

    private pollPromise?: Promise<void>;

    private destroyed = false;

    constructor(
        @Inject(CONFIG_MODULE_OPTIONS) private readonly options: ConfigModuleOptionsInterface
    ) {
        super(null as T);

        const configuredPollInterval = Number(options.fallbackPollIntervalInSeconds ?? DEFAULT_FALLBACK_POLL_INTERVAL_IN_SECONDS);

        this.fallbackPollIntervalInSeconds = clamp(
            Number.isFinite(configuredPollInterval)
                ? Math.round(configuredPollInterval)
                : DEFAULT_FALLBACK_POLL_INTERVAL_IN_SECONDS,
            MIN_FALLBACK_POLL_INTERVAL_IN_SECONDS,
            MAX_FALLBACK_POLL_INTERVAL_IN_SECONDS
        );
        this.client = new AppConfigDataClient(options.aws ?? {});
    }

    public async getValueAsync(): Promise<T> {
        const currentValue = this.getValue();

        if (currentValue !== null && currentValue !== undefined) {
            return currentValue;
        }

        await this.getConfiguration();

        return firstValueFrom(this.asObservable().pipe(
            filter((value): value is T => value !== null && value !== undefined),
            take(1)
        ));
    }

    private async initSession(): Promise<void> {
        this.logger.log('Initializing configuration session');

        const command = new StartConfigurationSessionCommand({
            ConfigurationProfileIdentifier: this.options.profileId,
            ApplicationIdentifier: this.options.applicationId,
            EnvironmentIdentifier: this.options.environmentId,
            RequiredMinimumPollIntervalInSeconds: this.fallbackPollIntervalInSeconds
        });

        const result = await this.client.send(command);

        if (!result.InitialConfigurationToken) {
            throw new AwsConfigError('Failed to get configuration token');
        }

        this.configurationSessionToken = result.InitialConfigurationToken;
    }

    private async ensureSessionInitialized(): Promise<void> {
        if (this.configurationSessionToken) {
            return;
        }

        this.initSessionPromise ??= this.initSession().finally(() => {
            this.initSessionPromise = undefined;
        });

        await this.initSessionPromise;
    }

    private async refreshConfiguration(): Promise<void> {
        this.logger.debug('Getting configuration');

        await this.ensureSessionInitialized();

        if (!this.configurationSessionToken) {
            throw new AwsConfigError('Failed to initialize configuration session token');
        }

        const command = new GetLatestConfigurationCommand({
            ConfigurationToken: this.configurationSessionToken
        });

        const result = await this.client.send(command);

        if (!result.$metadata.httpStatusCode || result.$metadata.httpStatusCode !== 200) {
            throw new AwsConfigError('Failed to get configuration');
        }

        const contentType = result.ContentType?.toLowerCase();

        if (!contentType?.startsWith('application/json')) {
            throw new AwsConfigError('Invalid content type');
        }

        if (!result.NextPollConfigurationToken) {
            throw new AwsConfigError('Failed to get next poll configuration token');
        }

        if (!result.Configuration) {
            throw new AwsConfigError('Failed to get configuration');
        }

        this.propagateConfiguration(result.Configuration);
        this.logger.debug('Configuration updated successfully');

        this.configurationSessionToken = result.NextPollConfigurationToken;
        this.scheduleNextPoll(result.NextPollIntervalInSeconds ?? this.fallbackPollIntervalInSeconds);
    }

    private async getConfiguration(): Promise<void> {
        this.pollPromise ??= this.refreshConfiguration().finally(() => {
            this.pollPromise = undefined;
        });

        await this.pollPromise;
    }

    private scheduleNextPoll(delayInSeconds: number): void {
        if (this.destroyed) {
            return;
        }

        if (this.scheduler) {
            clearTimeout(this.scheduler);
        }

        this.scheduler = setTimeout(() => {
            void this.getConfigurationSafe();
        }, delayInSeconds * 1000);
    }

    private async getConfigurationSafe(): Promise<void> {
        try {
            await this.getConfiguration();
        } catch (error: unknown) {
            this.logger.error(
                'Failed to refresh configuration',
                error instanceof Error ? error.stack : String(error)
            );
            this.scheduleNextPoll(this.fallbackPollIntervalInSeconds);
        }
    }

    private propagateConfiguration(data: ConfigurationPayload): void {
        const value = data.transformToString();

        if (!value) {
            const currentValue = this.getValue();

            if (currentValue !== null && currentValue !== undefined) {
                this.logger.debug('Skipping configuration update because configuration is not changed');

                return;
            }

            throw new AwsConfigError('Empty configuration');
        }

        this.next(JSON.parse(value) as T);
    }

    public async onModuleInit(): Promise<void> {
        await this.getConfiguration();

        this.logger.log('Configuration initialized successfully');
    }

    public onModuleDestroy(): void {
        this.destroyed = true;

        super.unsubscribe();

        if (this.scheduler) {
            clearTimeout(this.scheduler);
        }

        this.client.destroy();
    }
}
