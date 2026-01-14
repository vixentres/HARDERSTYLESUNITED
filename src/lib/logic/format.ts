export const extractUrl = (text: string): { url: string | null; isPending: boolean } => {
    const urlMatch = text.match(/(https?:\/\/[^\s)]+)/);
    if (urlMatch) return { url: urlMatch[1], isPending: false };
    return { url: null, isPending: true };
};

export const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';
    let clean = phone.replace(/\D/g, ''); // Remove all non-digits
    if (clean.length === 8) return `+569${clean}`;
    if (clean.length === 9) return `+56${clean}`;
    if (clean.length === 11 && clean.startsWith('56')) return `+${clean}`;
    if (phone.startsWith('+')) return `+${clean}`;
    return phone;
};

export const formatCurrency = (amount: number): string => {
    return (amount || 0).toLocaleString('es-CL');
};
