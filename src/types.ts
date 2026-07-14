// === Asset Types ===
export type AssetStatus = 'operational' | 'needs_repair' | 'maintenance' | 'missing';
// Categories are now dynamic strings - admin can create any category
export type AssetCategory = string;

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
  assignedTo?: string;
  lentTo?: string;       // Name of person who currently has the item
  lentAt?: string;       // When it was lent out
}

// === Session/Checkout Types ===
export interface SessionLog {
  id: string;
  studentName: string;
  rollNumber: string;
  assetId: string;
  purpose: string;
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

// === Maintenance Types ===
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

// === Studio Alert Types ===
export interface StudioAlert {
  id: string;
  assetId: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  reportedBy: string;
  reportedAt: string;
  resolved: boolean;
}

// === User/Access Types ===
export type UserRole = 'admin' | 'junior_admin' | 'member';

export interface AllowedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  addedBy: string;
  addedAt: string;
}

// === Music Release Types ===
export interface MusicRelease {
  id: string;
  title: string;
  year: number;
  releaseDate: string;
  coverUrl?: string;
  spotifyUrl?: string;
  appleMusicUrl?: string;
  youtubeMusicUrl?: string;
  description?: string;
  credits?: string;
  addedBy: string;
  addedAt: string;
}

// === Music Project Types ===
export type ProjectStage = 'composing' | 'arranging' | 'live_inputs' | 'mixing' | 'mastering' | 'completed';

export interface MusicProject {
  id: string;
  name: string;
  occasion: string;
  stage: ProjectStage;
  students: string[]; // List of student names/emails
  notes?: string;
  updatedBy: string;
  updatedAt: string;
  createdBy: string;
  createdAt: string;
  history?: {
    stage: ProjectStage;
    updatedBy: string;
    updatedAt: string;
    notes?: string;
  }[];
}

