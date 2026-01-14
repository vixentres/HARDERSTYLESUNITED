import { useMemo } from 'react';
import { User, AppState } from '../../types';

export const useClientView = (state: AppState) => {
    const isImpersonating = useMemo(() => {
        // We assume App.tsx sets currentUser to the impersonated user when active
        // But we can check if there is a discrepancy or specific flag if we had one
        // For now, let's rely on the passed state logic or add a local check if needed
        return state.currentUser?.email !== 'admin' && state.users.some(u => u.email === 'admin' && u.role === 'admin'); // Rough check, but better:
        // Actually, App.tsx passes the impersonated user as COMPONENT PROP 'state.currentUser'.
        // So this hook might be more useful to identifying if we are in "View Mode"
        // Let's look at how App.tsx handles it. 
        // We can pass a prop or context.
        // But sticking to the request: "Si impersonation activo... usar impersonatedClientId".
    }, [state]);

    // Since App.tsx already swaps 'currentUser' in the state prop passed to ClientDashboard,
    // this hook essentially standardizes access and can return the "Real" admin if needed, 
    // or just flags.

    // For this specific requirement ("Lecturas del Cliente"), if App.tsx does the swap, 
    // the "Client View" is already the default path.
    // However, we need to know if we are impersonating to DISABLE features (like editing).

    const clientUser = state.currentUser;
    // We can detect impersonation if we have a way to know the "real" user.
    // But ClientDashboard receives a modified state where currentUser IS the client.
    // So we assume downstream knows via a prop or context, OR we check localStorage here?
    const impersonatedStored = localStorage.getItem('impersonatingUser');
    const isViewMode = !!impersonatedStored; // Simple check

    return {
        clientUser,
        isViewMode,
        isReadOnly: isViewMode // Alias for clarity
    };
};
