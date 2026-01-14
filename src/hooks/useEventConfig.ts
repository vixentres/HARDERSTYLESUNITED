import { useState, useEffect } from 'react';
import { EventConfigService } from '../services/eventConfig';
import { SystemConfig } from '../../types';

export const useEventConfig = (initialConfig?: SystemConfig) => {
    const [config, setConfig] = useState<SystemConfig | null>(initialConfig || null);
    const [loading, setLoading] = useState(true);

    const refreshConfig = async () => {
        setLoading(true);
        const data = await EventConfigService.getConfig();
        if (data) setConfig(data);
        setLoading(false);
    };

    useEffect(() => {
        refreshConfig();
    }, []);

    return { config, loading, refreshConfig };
};
