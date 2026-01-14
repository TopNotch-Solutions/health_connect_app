export interface User {
    // Base fields (all users)
    fullname: string;
    email: string;
    cellphoneNumber: string;
    gender: string;
    address: string;
    role: string;
    walletID: string;
    userId: string;
    isPushNotificationEnabled: boolean;
    nationalId: string;
    balance?: number;
    profileImage: string | null;
    region?: string;
    town?: string;
    isAccountVerified: boolean;
    dateOfBirth?: string;

    // Health provider specific fields (optional)
    hpcnaNumber?: string;
    hpcnaExpiryDate?: string;
    specializations?: string[];
    yearsOfExperience?: number;
    operationalZone?: string;
    governingCouncil?: string;
    bio?: string;
    isDocumentsSubmitted?: boolean;
    isDocumentVerified?: boolean;
    HPCNAQualification?: string;
    finalQualification?: string;
    idDocumentFront?: string;
    idDocumentBack?: string;
}