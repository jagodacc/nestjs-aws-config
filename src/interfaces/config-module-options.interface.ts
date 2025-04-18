import { AppConfigDataClientConfig } from '@aws-sdk/client-appconfigdata';

export interface ConfigModuleOptionsInterface {
    profileId: string;
    applicationId: string;
    environmentId: string;
    aws?: AppConfigDataClientConfig;
}
