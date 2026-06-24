import { Asset, MaintenanceTask, SessionLog, StudioAlert } from '../types';

export const INITIAL_ASSETS: Asset[] = [
  // Computers
  {
    id: 'AST-PC-01',
    name: 'Computer 1 (iMac 24")',
    category: 'computer',
    model: 'Apple iMac M3 (16GB RAM / 512GB SSD)',
    serialNumber: 'C02FX4JKQ05D',
    location: 'Cubicle A (Primary DAW)',
    status: 'operational',
    remarks: 'Preloaded with Logic Pro X and GarageBand. Primary production workstation.',
    lastChecked: '2026-06-18',
    assignedTo: 'Computer 1'
  },
  {
    id: 'AST-PC-02',
    name: 'Computer 2 (Windows DAW)',
    category: 'computer',
    model: 'AMD Ryzen 7 Studio PC (32GB / RTX 3060)',
    serialNumber: 'SN-RYZ-98831',
    location: 'Cubicle B (Secondary DAW)',
    status: 'operational',
    remarks: 'Preloaded with Reaper, FL Studio, and Kontakt Player. Heavy arrangement workstation.',
    lastChecked: '2026-06-19',
    assignedTo: 'Computer 2'
  },
  {
    id: 'AST-PC-03',
    name: 'Computer 3 (Arrangement PC)',
    category: 'computer',
    model: 'Intel i5 MIDI Workstation (16GB RAM)',
    serialNumber: 'SN-INT-44911',
    location: 'Cubicle C (General Use)',
    status: 'operational',
    remarks: 'Preloaded with Audacity, Reaper, and virtual piano plugins. Good for basic learning.',
    lastChecked: '2026-06-18',
    assignedTo: 'Computer 3'
  },

  // Audio equipment
  {
    id: 'AST-AUD-01',
    name: 'JBL 104-BT Studio Monitors',
    category: 'audio',
    model: 'JBL Professional 104 Reference Monitors',
    serialNumber: 'JBL-104-9812A',
    location: 'Cubicle A Desk',
    status: 'operational',
    remarks: 'Main speakers connected to Computer 1 via balanced TSR.',
    lastChecked: '2026-06-17'
  },
  {
    id: 'AST-AUD-02',
    name: 'Presonus Eris E3.5 Monitors',
    category: 'audio',
    model: 'Presonus Eris Active Studio Monitors',
    serialNumber: 'PRE-ERIS-5512B',
    location: 'Cubicle B Desk',
    status: 'operational',
    remarks: 'Secondary speakers connected to Computer 2.',
    lastChecked: '2026-06-19'
  },
  {
    id: 'AST-AUD-03',
    name: 'Sennheiser HD 280 Pro',
    category: 'audio',
    model: 'HD 280 Pro Closed-back Headphones (Unit 1)',
    serialNumber: 'SEN-HD280-001',
    location: 'Computer 1 Station',
    status: 'operational',
    remarks: 'Daily checked, earcups clean. Make sure standard gold-plated adapter adapter is attached.',
    lastChecked: '2026-06-19',
    assignedTo: 'Computer 1'
  },
  {
    id: 'AST-AUD-04',
    name: 'Audio-Technica ATH-M40x',
    category: 'audio',
    model: 'ATH-M40x Professional Monitor Headphones (Unit 2)',
    serialNumber: 'ATH-M40X-002',
    location: 'Computer 2 Station',
    status: 'operational',
    remarks: 'Cable is detachable. Make sure students do not tug too hard.',
    lastChecked: '2026-06-18',
    assignedTo: 'Computer 2'
  },
  {
    id: 'AST-AUD-05',
    name: 'Sennheiser HD 206',
    category: 'audio',
    model: 'HD 206 Lightweight Headphones (Unit 3)',
    serialNumber: 'SEN-HD206-003',
    location: 'Computer 3 Station',
    status: 'operational',
    remarks: 'General headphones. Lightweight, clear output.',
    lastChecked: '2026-06-15',
    assignedTo: 'Computer 3'
  },
  {
    id: 'AST-AUD-06',
    name: 'Focusrite Scarlett 4i4 Interface',
    category: 'audio',
    model: 'Scarlett 4i4 Gen 3 USB Audio Interface',
    serialNumber: 'AS-SCAR-4I4-01',
    location: 'Cubicle B Desk',
    status: 'operational',
    remarks: 'Connected to AMD DAW PC. Drivers configured.',
    lastChecked: '2026-06-19'
  },

  // Instruments
  {
    id: 'AST-INS-01',
    name: 'M-Audio Keystation 49 MK3',
    category: 'instrument',
    model: 'Keystation 49 USB MIDI Keyboard',
    serialNumber: 'MA-KEYS49-8812',
    location: 'Cubicle A Station',
    status: 'operational',
    remarks: 'USB plug and play. Keys responsive.',
    lastChecked: '2026-06-19',
    assignedTo: 'Computer 1'
  },
  {
    id: 'AST-INS-02',
    name: 'Novation Launchkey 49',
    category: 'instrument',
    model: 'Launchkey 49 USB Controller with Pads',
    serialNumber: 'NOV-LK49-4122',
    location: 'Cubicle B Station',
    status: 'operational',
    remarks: 'Assigned to Computer 2. Excellent pads for music arrangement & beat production.',
    lastChecked: '2026-06-18',
    assignedTo: 'Computer 2'
  },
  {
    id: 'AST-INS-03',
    name: 'Yamaha F310 Acoustic Guitar',
    category: 'instrument',
    model: 'F310 Dreadnought Acoustic',
    serialNumber: 'YAM-GU-F310-A',
    location: 'Hostel Studio Guitar Stand',
    status: 'operational',
    remarks: 'Fretboard oiled and cleaned. Normal action setting.',
    lastChecked: '2026-06-16'
  },
  {
    id: 'AST-INS-04',
    name: 'Sai Harmonium (3-Octave)',
    category: 'instrument',
    model: 'Handcrafted Standard Scale Harmonium',
    serialNumber: 'SAI-HARM-01',
    location: 'Hostel Studio Instrument Bench',
    status: 'operational',
    remarks: 'Excellent bellow air compression, traditional Indian bhajan practice.',
    lastChecked: '2026-06-14'
  },

  // Cables
  {
    id: 'AST-CAB-01',
    name: 'MX Professional XLR Cable (5 Meter)',
    category: 'cable',
    model: 'MX Heavy Duty XLR-M to XLR-F',
    serialNumber: 'CAB-XLR-01',
    location: 'Cable Storage Board (Hooks)',
    status: 'operational',
    remarks: 'Strictly use Over-Under coiling. Cleaned regularly.',
    lastChecked: '2026-06-19'
  },
  {
    id: 'AST-CAB-02',
    name: 'MX 1/4 inch TS Guitar Cable',
    category: 'cable',
    model: 'MX 1/4" Jack Mono Cable for Guitars',
    serialNumber: 'CAB-TS-01',
    location: 'Cable Storage Board (Hooks)',
    status: 'operational',
    remarks: 'Used for guitar to audio interface connections.',
    lastChecked: '2026-06-18'
  },
  {
    id: 'AST-CAB-03',
    name: 'Balanced TRS Speaker Cables (Pair)',
    category: 'cable',
    model: '1/4" Balanced TRS patch cables',
    serialNumber: 'CAB-TRS-02',
    location: 'Computer 1 Desk Connection',
    status: 'operational',
    remarks: 'Connects Focusrite Scarlett to JBL Reference Monitors.',
    lastChecked: '2026-06-17'
  },
  {
    id: 'AST-CAB-04',
    name: 'Spare XLR Cable (3 Meter)',
    category: 'cable',
    model: 'Standard XLR connector',
    serialNumber: 'CAB-XLR-02',
    location: 'Cable Storage Board (Hooks)',
    status: 'needs_repair',
    remarks: 'Intermittent signal cut. Ground solder connection in pin-1 appears loose; needs soldering.',
    lastChecked: '2026-06-19'
  },

  // Accessories
  {
    id: 'AST-ACC-01',
    name: 'Pop Filter with Gooseneck',
    category: 'accessory',
    model: 'Dual Layer Mesh Shield Pop Filter',
    serialNumber: 'ACC-POP-01',
    location: 'Microphone Stand A',
    status: 'operational',
    remarks: 'Keep dry, wipe after recording sessions.',
    lastChecked: '2026-06-19'
  },
  {
    id: 'AST-ACC-02',
    name: 'K&M Boom Microphone Stand',
    category: 'accessory',
    model: 'Konig & Meyer Heavy Duty Stand',
    serialNumber: 'ACC-KM-STAND',
    location: 'Vocal corner',
    status: 'operational',
    remarks: 'Lock nut works fine, legs fold easily.',
    lastChecked: '2026-06-15'
  }
];

export const INITIAL_TASKS: MaintenanceTask[] = [
  {
    id: 'MNT-D-01',
    title: 'Daily Evening Ventilation and Dust Check',
    description: 'Ensure the hostel studio room gets properly ventilated to clear static-air moisture. Carefully wipe dust off screen terminals and piano/harmonium keys before shutting room.',
    frequency: 'daily',
    role: 'junior',
    lastDone: '2026-06-18',
    history: [
      { date: '2026-06-18', completedBy: 'Junior Incharge (Karthik)', remarks: 'Wiped all keys and computers. Room ventilated for 30 minutes.' },
      { date: '2026-06-17', completedBy: 'Junior Incharge (Karthik)', remarks: 'Fretted instruments wiped. General dust layer cleaned.' }
    ]
  },
  {
    id: 'MNT-D-02',
    title: 'Daily Power Shut-Down Sequencing',
    description: 'Enforce: turn off amplifiers/speakers FIRST, then audio interfaces, and finally shut down DAW computers. Turn off all main power sockets and extension stripes to avoid electrical surges.',
    frequency: 'daily',
    role: 'both',
    lastDone: '2026-06-18',
    history: [
      { date: '2026-06-18', completedBy: 'Head Incharge (Venkatesh)', remarks: 'Personally checked at 10 PM. Everything shut down. All lights toggled off.' }
    ]
  },
  {
    id: 'MNT-W-01',
    title: 'Weekly Cable Coiling and Tidy Check',
    description: 'Check hook rack. Cable inspect: ensure all cables are stored without tight kinks using the Over-Under layout. Check headphones for ear cushion moisture/cleanliness.',
    frequency: 'weekly',
    role: 'junior',
    lastDone: '2025-06-14',
    history: [
      { date: '2026-06-14', completedBy: 'Junior Incharge (Karthik)', remarks: 'Over-under method checked on all cables on the hooks. Coiled one loose adapter.' }
    ]
  },
  {
    id: 'MNT-W-02',
    title: 'Weekly Computer File Audit and Cleanup',
    description: 'Clean up temp download folders, export logs, and random WAV files from the desktop. Remind students to move their active arrangements into their named folders on separate local partitions: (D://SaiTunes_Students_2026/).',
    frequency: 'weekly',
    role: 'head',
    lastDone: '2026-06-15',
    history: [
      { date: '2026-06-15', completedBy: 'Head Incharge (Venkatesh)', remarks: 'Deleted 45GB of temporary cached bounce files. Sent WhatsApp reminder to students to clean up old projects.' }
    ]
  },
  {
    id: 'MNT-M-01',
    title: 'Monthly Deep Clean & Lint Removal',
    description: 'Unplug and vacuum detrás of computers. Clear fan grills on the Windows DAW PC case. Apply anti-corrosion spray / contact cleaner on jacks if oxidized.',
    frequency: 'monthly',
    role: 'both',
    lastDone: '2026-06-05',
    history: [
      { date: '2026-06-05', completedBy: 'Venkatesh & Karthik', remarks: 'Full joint maintenance. Cleaned CPU heat-sink fans, checked XLR soldering points, and wiped the acoustic guitar fretboard with lemon oil.' }
    ]
  },
  {
    id: 'MNT-M-02',
    title: 'Monthly Software License & Plugin Update',
    description: 'Check operating system updates and DAW licenses (FL Studio, Reaper, Logic updates). Keep local plugin database clean.',
    frequency: 'monthly',
    role: 'head',
    lastDone: '2026-06-01',
    history: [
      { date: '2026-06-01', completedBy: 'Head Incharge (Venkatesh)', remarks: 'Updated Reaper on PC-2 and PC-3. Checked the Focusrite Scarlett Control firmware.' }
    ]
  }
];

export const INITIAL_SESSIONS: SessionLog[] = [
  {
    id: 'SES-001',
    studentName: 'Sai Prasad',
    rollNumber: '25-MU-102',
    assetId: 'AST-PC-01',
    purpose: 'composition',
    checkInTime: '2026-06-18T16:30:00',
    checkOutTime: '2026-06-18T18:30:00',
    status: 'completed',
    initialChecks: {
      cleanDesk: true,
      cablesProper: true,
      noFoodDrink: true
    },
    finalChecks: {
      shutdownDone: true,
      cablesCoiled: true,
      speakersOff: true,
      deskClean: true
    },
    notes: 'Composed a custom flute arrangement with Kontakt orchestra library on Computer 1.'
  },
  {
    id: 'SES-002',
    studentName: 'Amith Kumar',
    rollNumber: '26-PH-04',
    assetId: 'AST-PC-02',
    purpose: 'mixing',
    checkInTime: '2026-06-19T11:00:00',
    checkOutTime: '2026-06-19T13:15:00',
    status: 'completed',
    initialChecks: {
      cleanDesk: true,
      cablesProper: true,
      noFoodDrink: true
    },
    finalChecks: {
      shutdownDone: true,
      cablesCoiled: true,
      speakersOff: true,
      deskClean: true
    },
    notes: 'Mixed and mastered the hostel choir track. Cleaned track project before ejecting SSD.'
  },
  {
    id: 'SES-003',
    studentName: 'Rohit Sharma',
    rollNumber: '24-BA-89',
    assetId: 'AST-PC-01',
    purpose: 'recording',
    checkInTime: '2026-06-19T15:30:00',
    status: 'active',
    initialChecks: {
      cleanDesk: true,
      cablesProper: true,
      noFoodDrink: true
    },
    notes: 'Currently recording acoustic guitar tracks using the Focusrite Solo and XLR cable.'
  }
];

export const INITIAL_ALERTS: StudioAlert[] = [
  {
    id: 'ALT-01',
    assetId: 'AST-CAB-04',
    severity: 'medium',
    description: 'XLR Cable exhibits crackling sounds when shaken near female XLR connector connector. Needs soldering.',
    reportedBy: 'Karthik (Junior Incharge)',
    reportedAt: '2026-06-19T11:45:00',
    resolved: false
  }
];
