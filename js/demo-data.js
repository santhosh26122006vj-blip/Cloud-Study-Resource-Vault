/**
 * Demo Data Seeder for Cloud Study Resource Vault
 * Seeds sample study resources pointing directly to project /resources/ files.
 * Zero Firebase Storage required.
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
    title: "Cloud Computing Unit 1",
    subject: "Cloud Computing",
    unit: "Unit 1",
    description: "Introduction to cloud computing concepts, NIST service models (IaaS, PaaS, SaaS), and virtualization mechanisms.",
    fileName: "cloud-computing-unit-1.pdf",
    fileUrl: "resources/cloud-computing-unit-1.pdf",
    fileType: "PDF",
    downloadCount: 14,
    isPublished: true
  },
  {
    title: "Cloud Computing Unit 2",
    subject: "Cloud Computing",
    unit: "Unit 2",
    description: "Cloud architecture models, distributed file systems, Object storage, and scalable multi-tenant infrastructure.",
    fileName: "cloud-computing-unit-2.pdf",
    fileUrl: "resources/cloud-computing-unit-2.pdf",
    fileType: "PDF",
    downloadCount: 22,
    isPublished: true
  },
  {
    title: "Database Management Systems Complete Notes",
    subject: "Database",
    unit: "Unit 1",
    description: "Comprehensive notes covering Relational Algebra, SQL queries, Normalization (1NF to BCNF), and ACID transactions.",
    fileName: "database-management-notes.pdf",
    fileUrl: "resources/database-management-notes.pdf",
    fileType: "PDF",
    downloadCount: 31,
    isPublished: true
  },
  {
    title: "Computer Networks Protocols & OSI Architecture",
    subject: "Computer Networks",
    unit: "Unit 2",
    description: "OSI 7-Layer architecture vs TCP/IP protocol suite, subnetting, CIDR notation, and network routing algorithms.",
    fileName: "computer-networks-notes.pdf",
    fileUrl: "resources/computer-networks-notes.pdf",
    fileType: "PDF",
    downloadCount: 19,
    isPublished: true
  },
  {
    title: "Cloud Security & Identity Access Management",
    subject: "Cloud Computing",
    unit: "Unit 3",
    description: "Zero Trust architecture, Shared Responsibility Model, IAM policies, and cloud encryption standards.",
    fileName: "cloud-security-overview.pdf",
    fileUrl: "resources/cloud-security-overview.pdf",
    fileType: "PDF",
    downloadCount: 8,
    isPublished: true
  },
  {
    title: "Web Technology & Frontend Architectures",
    subject: "Web Technology",
    unit: "Unit 1",
    description: "HTML5 semantic tags, responsive CSS3 grids, Vanilla JavaScript DOM operations, and client-side storage.",
    fileName: "web-technology-notes.pdf",
    fileUrl: "resources/web-technology-notes.pdf",
    fileType: "PDF",
    downloadCount: 27,
    isPublished: true
  }
];

export async function seedDemoData(currentUser) {
  const uid = currentUser?.uid || "admin-system";
  const name = currentUser?.name || currentUser?.displayName || "Admin";

  if (!isConfigured) {
    const existing = JSON.parse(localStorage.getItem('study_vault_mock_resources') || '[]');
    if (existing.length > 0) {
      showToast("Data Ready", "Sample college resources are already loaded.", "info");
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
    showToast("Success", "Loaded sample resources from project /resources/ folder!", "success");
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

    showToast("Data Seeded", `Successfully added ${count} resources to Cloud Firestore!`, "success");
  } catch (error) {
    console.error("Error seeding resources:", error);
    showToast("Seeding Error", error.message, "error");
  }
}
