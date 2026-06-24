export type AssetStatus = 'operational' | 'needs_repair' | 'maintenance' | 'missing';
export type AssetCategory = 'computer' | 'audio' | 'instrument' | 'cable' | 'accessory';

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  model: string;
  serialNumber: string;
  location: string;
  status: AssetStatus;
  remarks: string;
  lastChecked: string;
  assignedTo?: string; // e.g. Computer 1, Common, etc.
}

export interface SessionLog {
  id: string;
  studentName: string;
  rollNumber: string;
  assetId: string; // e.g. Computer 1, Guitar
  purpose: 'composition' | 'recording' | 'mixing' | 'practice' | 'other';
  checkInTime: string;
  checkOutTime?: string;
  status: 'active' | 'completed';
  initialChecks: {
    cleanDesk: boolean;
    cablesProper: boolean;
    noFoodDrink: boolean;
  };
  finalChecks?: {
    shutdownDone: boolean;
    cablesCoiled: boolean;
    speakersOff: boolean;
    deskClean: boolean;
  };
  notes?: string;
}

export interface MaintenanceTask {
  id: string;
  title: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  role: 'head' | 'junior' | 'both';
  lastDone?: string;
  history: {
    date: string;
    completedBy: string;
    remarks: string;
  }[];
}

export interface StudioAlert {
  id: string;
  assetId: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  reportedBy: string;
  reportedAt: string;
  resolved: boolean;
}
