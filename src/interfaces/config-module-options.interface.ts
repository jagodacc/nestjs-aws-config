import { AppConfigDataClientConfig } from '@aws-sdk/client-appconfigdata';

export interface ConfigModuleOptionsInterface {
    /** AWS AppConfig configuration profile ID. */
    profileId: string;

    /** AWS AppConfig application ID. */
    applicationId: string;

    /** AWS AppConfig environment ID. */
    environmentId: string;

    /**
     * Fallback polling interval used when AWS response does not provide `NextPollIntervalInSeconds`
     * and for retry delay after refresh failures.
     *
     * The value is clamped to range 1..3600 seconds.
     *
     * @default 60
     */
    fallbackPollIntervalInSeconds?: number;

    /** Optional AWS SDK client configuration. */
    aws?: AppConfigDataClientConfig;
}
