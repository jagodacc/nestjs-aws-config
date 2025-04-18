import { DynamicModule, Module } from '@nestjs/common';
import { CONFIG_MODULE_OPTIONS } from './consts';
import { ConfigModuleOptionsInterface } from './interfaces/config-module-options.interface';
import { ConfigService } from './services/config.service';

@Module({})
export class ConfigModule {
    public static forRootAsync({ useFactory, inject, isGlobal }: {
        useFactory: (...args: any[]) => Promise<ConfigModuleOptionsInterface> | ConfigModuleOptionsInterface;
        inject?: any[];
        isGlobal?: boolean;
    }): DynamicModule {
        return {
            module: ConfigModule,
            providers: [
                {
                    provide: CONFIG_MODULE_OPTIONS,
                    useFactory,
                    inject: inject || []
                },
                ConfigService
            ],
            exports: [ConfigService],
            global: isGlobal ?? true
        };
    }

    public static forRoot({ isGlobal, ...options }: ConfigModuleOptionsInterface & {isGlobal?: boolean;}): DynamicModule {
        return this.forRootAsync({
            useFactory: () => options,
            isGlobal
        });
    }
}
