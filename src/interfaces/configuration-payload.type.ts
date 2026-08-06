import type { GetLatestConfigurationCommandOutput } from '@aws-sdk/client-appconfigdata';

export type ConfigurationPayload = NonNullable<GetLatestConfigurationCommandOutput['Configuration']>;
