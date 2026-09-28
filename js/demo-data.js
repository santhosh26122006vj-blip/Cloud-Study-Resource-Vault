/**
 * Demo Data Seeder for Cloud Study Resource Vault
 * Allows 1-click generation of the 7 college curriculum sample resources into Firestore.
 */

import {
  db,
  isConfigured,
  collection,
  addDoc,
  serverTimestamp
} from './firebase-config.js';

import { showToast } from './ui.js';

export const SAMPLE_RESOURCES = [
  {
    title: "Cloud Computing Unit 1 Notes: Fundamentals & Virtualization",
    description: "Comprehensive lecture notes covering cloud service models (IaaS, PaaS, SaaS), deployment architectures (Public, Private, Hybrid), and Hypervisor virtualization mechanisms.",
    subject: "Cloud Computing",
    category: "Notes",
    semester: "Semester 5",
    type: "PDF",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileName: "Cloud_Computing_Unit_1_Fundamentals.pdf",
    fileSize: 2450000,
    tags: ["Cloud", "Virtualization", "IaaS", "PaaS", "SaaS"]
  },
  {
    title: "Cloud Computing Unit 2 Notes: Cloud Architecture & Storage Services",
    description: "Detailed notes examining cloud data storage models, distributed file systems, Object Storage (S3/GCS), and scalable multi-tenant infrastructure.",
    subject: "Cloud Computing",
    category: "Notes",
    semester: "Semester 5",
    type: "PDF",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileName: "Cloud_Computing_Unit_2_Architecture.pdf",
    fileSize: 3120000,
    tags: ["Cloud Architecture", "Object Storage", "Distributed Systems"]
  },
  {
    title: "Cloud Computing End-Semester Question Paper (2024)",
    description: "Previous year university final examination question paper with question bank, answer key, and marks distribution for Cloud Computing.",
    subject: "Cloud Computing",
    category: "Question Papers",
    semester: "Semester 5",
    type: "PDF",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileName: "Cloud_Computing_Question_Paper_2024.pdf",
    fileSize: 1100000,
    tags: ["Question Paper", "Exams", "Previous Year", "University"]
  },
  {
    title: "Cloud Security & Identity Access Management Presentation",
    description: "Presentation slide deck highlighting cloud threat vectors, Shared Responsibility Model, Zero Trust architecture, OAuth2, and IAM role-based access control.",
    subject: "Cloud Computing",
    category: "Presentations",
    semester: "Semester 5",
    type: "Presentation",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileName: "Cloud_Security_IAM_Slides.pptx",
    fileSize: 4200000,
    tags: ["Security", "IAM", "Zero Trust", "OAuth2", "Slides"]
  },
  {
    title: "Database Management Systems Complete Unit Notes",
    description: "Comprehensive study material covering Relational Algebra, SQL queries, Normalization (1NF to BCNF), and ACID transactions.",
    subject: "Database Management Systems",
    category: "Notes",
    semester: "Semester 3",
    type: "PDF",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileName: "DBMS_Complete_Notes.pdf",
    fileSize: 3800000,
    tags: ["DBMS", "SQL", "Normalization", "Transactions", "ACID"]
  },
  {
    title: "Computer Networks Mid-Term Question Paper with Solutions",
    description: "Mid-term exam question paper covering OSI 7-Layer model, TCP/IP protocol suite, subnetting, CIDR, and routing algorithms.",
    subject: "Computer Networks",
    category: "Question Papers",
    semester: "Semester 4",
    type: "PDF",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileName: "Computer_Networks_Question_Paper.pdf",
    fileSize: 1450000,
    tags: ["Networks", "OSI", "TCP/IP", "Subnetting", "Routing"]
  },
  {
    title: "Java Programming & Object-Oriented Design Lecture Notes",
    description: "Core Java study vault notes on OOP pillars (Encapsulation, Inheritance, Polymorphism, Abstraction), Generics, Multithreading, and Exception Handling.",
    subject: "Java Programming",
    category: "Notes",
    semester: "Semester 2",
    type: "Document",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileName: "Java_Programming_OOP_Notes.docx",
    fileSize: 2200000,
    tags: ["Java", "OOP", "Multithreading", "Generics", "Collections"]
  }
];

export async function seedDemoData(currentUser) {
  const uid = currentUser?.uid || "admin-system";
  const name = currentUser?.name || currentUser?.displayName || "Professor / System";

  if (!isConfigured) {
    // Store in local storage for instant demo without Firebase keys
    const existing = JSON.parse(localStorage.getItem('study_vault_mock_resources') || '[]');
    if (existing.length > 0) {
      showToast("Demo Data Ready", "Sample college resources are already loaded.", "info");
      return;
    }

    const seeded = SAMPLE_RESOURCES.map((res, index) => ({
      id: "res-demo-" + (index + 1),
      ...res,
      uploadedBy: uid,
      uploaderName: name,
      createdAt: new Date(Date.now() - (index * 86400000)).toISOString()
    }));

    localStorage.setItem('study_vault_mock_resources', JSON.stringify(seeded));
    showToast("Success", "Seeded 7 college curriculum study resources!", "success");
    return;
  }

  try {
    const resourcesCol = collection(db, "resources");
    let count = 0;

    for (const item of SAMPLE_RESOURCES) {
      await addDoc(resourcesCol, {
        ...item,
        uploadedBy: uid,
        uploaderName: name,
        createdAt: serverTimestamp()
      });
      count++;
    }

    showToast("Demo Data Seeded", `Successfully created ${count} sample resources in Cloud Firestore!`, "success");
  } catch (error) {
    console.error("Error seeding resources:", error);
    showToast("Error Seeding", error.message, "error");
  }
}
