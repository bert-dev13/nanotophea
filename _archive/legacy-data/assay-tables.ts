const DOSE_ARRAY = [0, 6.25, 12.5, 25, 50, 100, 200]
const BASE_VIAB = [100, 89.4, 76.1, 58.3, 41.2, 24.6, 12.1]
const BASE_ABS = BASE_VIAB.map((v) => +(v / 100 * 1.842).toFixed(3))
const MTT_TABLE = DOSE_ARRAY.map((d, i) => ({
  conc: d, viability: BASE_VIAB[i], inhibition: +(100 - BASE_VIAB[i]).toFixed(1), absorbance: BASE_ABS[i],
}))

const ROS_TABLE = [
  { conc: 0, control: 100, treated: 100, ros_fold: 1.0 },
  { conc: 6.25, control: 100, treated: 138, ros_fold: 1.38 },
  { conc: 12.5, control: 100, treated: 172, ros_fold: 1.72 },
  { conc: 25, control: 100, treated: 219, ros_fold: 2.19 },
  { conc: 50, control: 100, treated: 284, ros_fold: 2.84 },
  { conc: 100, control: 100, treated: 341, ros_fold: 3.41 },
]

const YAP_TABLE = [
  { protein: "YAP1", treated: 0.31 }, { protein: "TEAD4", treated: 0.44 },
  { protein: "LATS1", treated: 1.82 }, { protein: "MOB1", treated: 1.67 },
  { protein: "p-YAP S127", treated: 2.14 }, { protein: "CYR61", treated: 0.39 },
  { protein: "CTGF", treated: 0.42 },
]

const BAX_TABLE = [
  { marker: "BAX", treated: 3.24 }, { marker: "BCL-2", treated: 0.28 },
  { marker: "BAX/BCL-2", treated: 11.57 }, { marker: "Cyt-c", treated: 2.87 },
  { marker: "CASP-9", treated: 2.51 }, { marker: "CASP-3", treated: 3.08 },
  { marker: "PARP", treated: 0.19 },
]

const RADAR_DATA = [
  { subject: "Cytotoxicity", value: 88 }, { subject: "Antioxidant", value: 92 },
  { subject: "Apoptosis", value: 85 }, { subject: "Hepatoprotective", value: 79 },
  { subject: "Anti-proliferative", value: 83 }, { subject: "Drug-likeness", value: 74 },
]

const ROS_DUAL = ROS_TABLE.map(r => ({
  conc: r.conc,
  cancer_ros: r.ros_fold,
  normal_ros: +(1 + (r.ros_fold - 1) * 0.17).toFixed(2),
}))
const ROS_ENZYME = [
  { label: "HO-1",     change:  109, type: "up"   },
  { label: "SOD",      change:  118, type: "up"   },
  { label: "Catalase", change:   94, type: "up"   },
  { label: "GPx",      change:   76, type: "up"   },
  { label: "MDA",      change:  -67, type: "down" },
  { label: "4-HNE",    change:  -58, type: "down" },
]

const DOCKING_TARGETS = [
  { receptor: "YAP1",      pdbId: "5YLH", score: -8.4, ki: "0.68 µM", rmsd: "1.12 Å", confidence: 94, color: "#4fc3f7", hBonds: 4 },
  { receptor: "Nrf2",      pdbId: "4IS9", score: -8.1, ki: "1.02 µM", rmsd: "1.05 Å", confidence: 92, color: "#fbbf24", hBonds: 5 },
  { receptor: "BAX",       pdbId: "4S0O", score: -7.9, ki: "1.64 µM", rmsd: "0.89 Å", confidence: 91, color: "#fb923c", hBonds: 3 },
  { receptor: "BCL-2",     pdbId: "2YIU", score: -7.6, ki: "2.73 µM", rmsd: "0.94 Å", confidence: 89, color: "#f472b6", hBonds: 3 },
  { receptor: "Caspase-3", pdbId: "2XYG", score: -7.2, ki: "4.82 µM", rmsd: "1.38 Å", confidence: 87, color: "#a78bfa", hBonds: 2 },
  { receptor: "LATS1",     pdbId: "5YLH", score: -6.8, ki: "9.22 µM", rmsd: "1.61 Å", confidence: 82, color: "#34d399", hBonds: 2 },
]

export {
  DOSE_ARRAY, BASE_VIAB, BASE_ABS, MTT_TABLE, ROS_TABLE, YAP_TABLE, BAX_TABLE, RADAR_DATA,
  ROS_DUAL, ROS_ENZYME, DOCKING_TARGETS,
}
