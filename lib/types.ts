export type Link = { label: string; url: string; showOnResume: boolean };

export type Profile = {
  name: string;
  title: string;
  tagline: string;
  location: string;
  phone: string;
  email: string;
  /** Cache-busting version of the uploaded photo ('' = no photo). The file itself lives in data/photo.(jpg|png). */
  photo: string;
  available: boolean;
  showPhoneOnSite: boolean;
  links: Link[];
};

export type SkillGroup = { category: string; items: string[] };

export type Experience = {
  id: string;
  role: string;
  company: string;
  location: string;
  start: string;
  end: string;
  tech: string[];
  bullets: string[];
};

export type Project = {
  id: string;
  name: string;
  subtitle: string;
  start: string;
  end: string;
  tech: string[];
  summary: string;
  bullets: string[];
  /** Deployed site. When there are no screenshots, the card shows a live capture of this page. */
  demo: string;
  /** Source code (GitHub). */
  repo: string;
  /** Any extra links (video, case study, docs…). */
  links: { label: string; url: string }[];
  /** Screenshots: uploaded (/api/uploads/…) or pasted image URLs. The first is the cover. */
  images: string[];
  autoPreview: boolean;
  featured: boolean;
};

export type Education = { id: string; degree: string; school: string; start: string; end: string; score: string };
/** `course`: the programme it's for, e.g. "Java Full Stack"; `url`: where anyone can view the certificate. */
export type Certification = { id: string; name: string; course: string; issuer: string; date: string; url: string };

/** Resume designs, in the order the pickers show them. */
export const TEMPLATES = ['creative', 'classic', 'modern', 'timeline'] as const;
export type Template = (typeof TEMPLATES)[number];
export const TEMPLATE_INFO: Record<Template, { name: string; blurb: string }> = {
  creative: { name: 'Creative', blurb: 'Two-column, modern' },
  classic: { name: 'Classic ATS', blurb: 'Single column, recruiter-friendly' },
  modern: { name: 'Modern', blurb: 'Bold coloured sidebar' },
  timeline: { name: 'Timeline', blurb: 'Dates down the side, elegant' },
};
export const isTemplate = (v: unknown): v is Template => TEMPLATES.includes(v as Template);

export type ResumeSettings = {
  template: Template;
  paper: 'Letter' | 'A4';
  accent: string;
  fitOnePage: boolean;
  showPhoto: boolean;
  showProjectLinks: boolean;
  projectIds: string[];
  /** What the public "Download resume" buttons give: the PDF generated from the site, or a PDF you uploaded. */
  source: 'generated' | 'uploaded';
  /** Original file name of the uploaded PDF ('' = none uploaded). The file lives in data/resume.pdf. */
  uploadedName: string;
};

export type Portfolio = {
  /** Set by the server on every save; a save must quote the version it was based on (prevents lost updates). */
  updatedAt: string;
  profile: Profile;
  summary: string;
  about: string;
  skills: SkillGroup[];
  experience: Experience[];
  projects: Project[];
  education: Education[];
  certifications: Certification[];
  achievements: string[];
  settings: {
    resume: ResumeSettings;
    site: { accent: string; theme: 'dark' | 'light' };
  };
};

export const MAX_RESUME_PROJECTS = 3;
