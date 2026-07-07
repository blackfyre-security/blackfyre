// GDPR Articles 1-50 (EU Regulation 2016/679)
// Source: gdpr-info.eu / eur-lex.europa.eu (public)

export interface GdprControl {
  controlId: string;              // e.g., "Art.5", "Art.32"
  articleNumber: number;
  controlName: string;            // article title
  description: string;            // 1-2 sentence summary of the article's obligation
  chapter: string;                // Roman numeral + name, e.g., "II - Principles"
  category: string;               // your grouping: "Principles", "Rights", "Controller Obligations", "Transfers", etc.
  weight: 1 | 2 | 3;
  actor: ("controller" | "processor" | "data_subject" | "authority")[];
  reference: string;              // "GDPR Article X"
}

export const gdpr_part1: GdprControl[] = [
  // Chapter I - General provisions (Art 1-4)
  {
    controlId: "Art.1",
    articleNumber: 1,
    controlName: "Subject-matter and objectives",
    description:
      "Establishes that the Regulation lays down rules on the protection of natural persons with regard to the processing of personal data and the free movement of such data, protecting fundamental rights and freedoms, in particular the right to protection of personal data.",
    chapter: "I - General provisions",
    category: "General Provisions",
    weight: 1,
    actor: ["controller", "processor", "data_subject", "authority"],
    reference: "GDPR Article 1",
  },
  {
    controlId: "Art.2",
    articleNumber: 2,
    controlName: "Material scope",
    description:
      "Defines the material scope: the Regulation applies to the processing of personal data wholly or partly by automated means and to non-automated processing of personal data which form part of a filing system, with specified exclusions (e.g., purely personal/household activity, law enforcement directive scope).",
    chapter: "I - General provisions",
    category: "General Provisions",
    weight: 1,
    actor: ["controller", "processor", "authority"],
    reference: "GDPR Article 2",
  },
  {
    controlId: "Art.3",
    articleNumber: 3,
    controlName: "Territorial scope",
    description:
      "Sets the territorial scope: the Regulation applies to processing by controllers/processors established in the Union, and to processing of EU data subjects' data by controllers/processors not established in the Union where offering goods/services or monitoring behaviour in the Union.",
    chapter: "I - General provisions",
    category: "General Provisions",
    weight: 2,
    actor: ["controller", "processor"],
    reference: "GDPR Article 3",
  },
  {
    controlId: "Art.4",
    articleNumber: 4,
    controlName: "Definitions",
    description:
      "Provides the key definitions used throughout the Regulation, including 'personal data', 'processing', 'controller', 'processor', 'consent', 'personal data breach', 'profiling', 'pseudonymisation' and others.",
    chapter: "I - General provisions",
    category: "General Provisions",
    weight: 1,
    actor: ["controller", "processor", "data_subject", "authority"],
    reference: "GDPR Article 4",
  },

  // Chapter II - Principles (Art 5-11)
  {
    controlId: "Art.5",
    articleNumber: 5,
    controlName: "Principles relating to processing of personal data",
    description:
      "Sets the core principles: lawfulness, fairness and transparency; purpose limitation; data minimisation; accuracy; storage limitation; integrity and confidentiality; and accountability of the controller to demonstrate compliance with these principles.",
    chapter: "II - Principles",
    category: "Principles",
    weight: 3,
    actor: ["controller"],
    reference: "GDPR Article 5",
  },
  {
    controlId: "Art.6",
    articleNumber: 6,
    controlName: "Lawfulness of processing",
    description:
      "Requires at least one lawful basis for processing (consent, contract, legal obligation, vital interests, public interest/official authority, or legitimate interests) and sets conditions for further processing compatible with the original purpose.",
    chapter: "II - Principles",
    category: "Principles",
    weight: 3,
    actor: ["controller"],
    reference: "GDPR Article 6",
  },
  {
    controlId: "Art.7",
    articleNumber: 7,
    controlName: "Conditions for consent",
    description:
      "Specifies conditions for valid consent: the controller must be able to demonstrate consent; requests must be clearly distinguishable and in plain language; the data subject has the right to withdraw consent at any time as easily as it was given.",
    chapter: "II - Principles",
    category: "Principles",
    weight: 3,
    actor: ["controller", "data_subject"],
    reference: "GDPR Article 7",
  },
  {
    controlId: "Art.8",
    articleNumber: 8,
    controlName: "Conditions applicable to child's consent in relation to information society services",
    description:
      "Where an information society service is offered directly to a child, consent is lawful only if the child is at least 16 (Member States may lower to 13); otherwise, the holder of parental responsibility must authorise the processing.",
    chapter: "II - Principles",
    category: "Principles",
    weight: 2,
    actor: ["controller", "data_subject"],
    reference: "GDPR Article 8",
  },
  {
    controlId: "Art.9",
    articleNumber: 9,
    controlName: "Processing of special categories of personal data",
    description:
      "Prohibits processing of special-category data (racial/ethnic origin, political opinions, religion, trade union membership, genetic/biometric data, health, sex life/orientation) unless one of the listed exceptions applies (e.g., explicit consent, employment law, vital interests, public interest).",
    chapter: "II - Principles",
    category: "Principles",
    weight: 2,
    actor: ["controller", "processor"],
    reference: "GDPR Article 9",
  },
  {
    controlId: "Art.10",
    articleNumber: 10,
    controlName: "Processing of personal data relating to criminal convictions and offences",
    description:
      "Processing of personal data relating to criminal convictions and offences may only be carried out under the control of official authority or when authorised by Union or Member State law providing appropriate safeguards.",
    chapter: "II - Principles",
    category: "Principles",
    weight: 2,
    actor: ["controller", "authority"],
    reference: "GDPR Article 10",
  },
  {
    controlId: "Art.11",
    articleNumber: 11,
    controlName: "Processing which does not require identification",
    description:
      "Where processing purposes do not require identification of a data subject, the controller is not obliged to maintain/acquire additional information solely to comply with the Regulation; certain data subject rights (Arts 15-20) may then not apply unless the data subject provides additional identifying information.",
    chapter: "II - Principles",
    category: "Principles",
    weight: 1,
    actor: ["controller"],
    reference: "GDPR Article 11",
  },

  // Chapter III - Rights of the data subject (Art 12-23)
  {
    controlId: "Art.12",
    articleNumber: 12,
    controlName: "Transparent information, communication and modalities for the exercise of the rights of the data subject",
    description:
      "Controllers must provide information and communications relating to processing in a concise, transparent, intelligible and easily accessible form, using clear and plain language; responses to data subject requests must generally be provided within one month free of charge.",
    chapter: "III - Rights of the data subject",
    category: "Rights",
    weight: 2,
    actor: ["controller", "data_subject"],
    reference: "GDPR Article 12",
  },
  {
    controlId: "Art.13",
    articleNumber: 13,
    controlName: "Information to be provided where personal data are collected from the data subject",
    description:
      "When data are collected directly from the data subject, the controller must provide identity/contact of controller and DPO, purposes and legal basis, recipients, transfers, retention period, rights, and other specified information at the time of collection.",
    chapter: "III - Rights of the data subject",
    category: "Rights",
    weight: 2,
    actor: ["controller", "data_subject"],
    reference: "GDPR Article 13",
  },
  {
    controlId: "Art.14",
    articleNumber: 14,
    controlName: "Information to be provided where personal data have not been obtained from the data subject",
    description:
      "When personal data are obtained from a source other than the data subject, the controller must still provide the specified information (within a reasonable period, at the latest one month, or at first communication/disclosure), subject to certain exceptions.",
    chapter: "III - Rights of the data subject",
    category: "Rights",
    weight: 2,
    actor: ["controller", "data_subject"],
    reference: "GDPR Article 14",
  },
  {
    controlId: "Art.15",
    articleNumber: 15,
    controlName: "Right of access by the data subject",
    description:
      "The data subject has the right to obtain confirmation as to whether personal data concerning them are being processed and, where that is the case, access to the data and specified information (purposes, categories, recipients, retention, rights, source, automated decision-making).",
    chapter: "III - Rights of the data subject",
    category: "Rights",
    weight: 2,
    actor: ["controller", "data_subject"],
    reference: "GDPR Article 15",
  },
  {
    controlId: "Art.16",
    articleNumber: 16,
    controlName: "Right to rectification",
    description:
      "The data subject has the right to obtain from the controller without undue delay the rectification of inaccurate personal data concerning them and the right to have incomplete data completed.",
    chapter: "III - Rights of the data subject",
    category: "Rights",
    weight: 2,
    actor: ["controller", "data_subject"],
    reference: "GDPR Article 16",
  },
  {
    controlId: "Art.17",
    articleNumber: 17,
    controlName: "Right to erasure ('right to be forgotten')",
    description:
      "The data subject has the right to obtain erasure of personal data without undue delay where one of the specified grounds applies (data no longer necessary, consent withdrawn, unlawful processing, legal obligation, etc.), subject to defined exceptions.",
    chapter: "III - Rights of the data subject",
    category: "Rights",
    weight: 2,
    actor: ["controller", "data_subject"],
    reference: "GDPR Article 17",
  },
  {
    controlId: "Art.18",
    articleNumber: 18,
    controlName: "Right to restriction of processing",
    description:
      "The data subject has the right to obtain restriction of processing in specified cases (accuracy contested, unlawful processing but erasure opposed, data no longer needed but required for legal claims, objection pending).",
    chapter: "III - Rights of the data subject",
    category: "Rights",
    weight: 2,
    actor: ["controller", "data_subject"],
    reference: "GDPR Article 18",
  },
  {
    controlId: "Art.19",
    articleNumber: 19,
    controlName: "Notification obligation regarding rectification or erasure of personal data or restriction of processing",
    description:
      "The controller must communicate any rectification, erasure or restriction of processing to each recipient to whom the personal data have been disclosed, unless this proves impossible or involves disproportionate effort.",
    chapter: "III - Rights of the data subject",
    category: "Rights",
    weight: 2,
    actor: ["controller"],
    reference: "GDPR Article 19",
  },
  {
    controlId: "Art.20",
    articleNumber: 20,
    controlName: "Right to data portability",
    description:
      "The data subject has the right to receive personal data concerning them, which they have provided to a controller, in a structured, commonly used and machine-readable format, and to transmit those data to another controller where processing is based on consent or contract and carried out by automated means.",
    chapter: "III - Rights of the data subject",
    category: "Rights",
    weight: 2,
    actor: ["controller", "data_subject"],
    reference: "GDPR Article 20",
  },
  {
    controlId: "Art.21",
    articleNumber: 21,
    controlName: "Right to object",
    description:
      "The data subject has the right to object, on grounds relating to their particular situation, to processing based on public interest or legitimate interests (including profiling), and an absolute right to object to direct marketing.",
    chapter: "III - Rights of the data subject",
    category: "Rights",
    weight: 2,
    actor: ["controller", "data_subject"],
    reference: "GDPR Article 21",
  },
  {
    controlId: "Art.22",
    articleNumber: 22,
    controlName: "Automated individual decision-making, including profiling",
    description:
      "The data subject has the right not to be subject to a decision based solely on automated processing, including profiling, which produces legal or similarly significant effects, subject to exceptions (contract necessity, Union/Member State law, explicit consent) with safeguards.",
    chapter: "III - Rights of the data subject",
    category: "Rights",
    weight: 2,
    actor: ["controller", "data_subject"],
    reference: "GDPR Article 22",
  },
  {
    controlId: "Art.23",
    articleNumber: 23,
    controlName: "Restrictions",
    description:
      "Union or Member State law may restrict by legislative measure the scope of the obligations and rights in Arts 12-22, 34 and 5 (to the extent corresponding), where such a restriction respects the essence of fundamental rights and is a necessary and proportionate measure to safeguard specified interests (e.g., national security, defence, public security).",
    chapter: "III - Rights of the data subject",
    category: "Rights",
    weight: 1,
    actor: ["authority"],
    reference: "GDPR Article 23",
  },

  // Chapter IV - Controller and processor (Art 24-43)
  // Section 1 - General obligations (Art 24-31)
  {
    controlId: "Art.24",
    articleNumber: 24,
    controlName: "Responsibility of the controller",
    description:
      "The controller must implement appropriate technical and organisational measures, taking into account risk, to ensure and be able to demonstrate that processing is performed in accordance with the Regulation; measures must be reviewed and updated where necessary.",
    chapter: "IV - Controller and processor",
    category: "Controller Obligations",
    weight: 2,
    actor: ["controller"],
    reference: "GDPR Article 24",
  },
  {
    controlId: "Art.25",
    articleNumber: 25,
    controlName: "Data protection by design and by default",
    description:
      "The controller must implement appropriate technical and organisational measures (e.g., pseudonymisation) at the time of determining the means of processing and at the time of processing, and ensure that by default only personal data necessary for each specific purpose are processed.",
    chapter: "IV - Controller and processor",
    category: "Controller Obligations",
    weight: 3,
    actor: ["controller"],
    reference: "GDPR Article 25",
  },
  {
    controlId: "Art.26",
    articleNumber: 26,
    controlName: "Joint controllers",
    description:
      "Where two or more controllers jointly determine the purposes and means of processing, they must determine their respective responsibilities for compliance in a transparent arrangement, the essence of which must be made available to the data subject.",
    chapter: "IV - Controller and processor",
    category: "Controller Obligations",
    weight: 2,
    actor: ["controller"],
    reference: "GDPR Article 26",
  },
  {
    controlId: "Art.27",
    articleNumber: 27,
    controlName: "Representatives of controllers or processors not established in the Union",
    description:
      "Controllers/processors outside the Union subject to Art 3(2) must designate in writing a representative in the Union, subject to limited exceptions (occasional processing that is not large-scale special category / criminal data, public authorities).",
    chapter: "IV - Controller and processor",
    category: "Controller Obligations",
    weight: 1,
    actor: ["controller", "processor"],
    reference: "GDPR Article 27",
  },
  {
    controlId: "Art.28",
    articleNumber: 28,
    controlName: "Processor",
    description:
      "Processing by a processor must be governed by a written contract or binding legal act specifying required terms (subject matter, duration, purposes, obligations, confidentiality, security, sub-processors, assistance, deletion/return, audits); processors must only act on documented instructions.",
    chapter: "IV - Controller and processor",
    category: "Controller Obligations",
    weight: 3,
    actor: ["controller", "processor"],
    reference: "GDPR Article 28",
  },
  {
    controlId: "Art.29",
    articleNumber: 29,
    controlName: "Processing under the authority of the controller or processor",
    description:
      "The processor and any person acting under the authority of the controller or processor who has access to personal data must not process those data except on instructions from the controller, unless required to do so by Union or Member State law.",
    chapter: "IV - Controller and processor",
    category: "Controller Obligations",
    weight: 2,
    actor: ["controller", "processor"],
    reference: "GDPR Article 29",
  },
  {
    controlId: "Art.30",
    articleNumber: 30,
    controlName: "Records of processing activities",
    description:
      "Controllers (and processors) must maintain a written record of processing activities under their responsibility, containing specified information (purposes, categories, recipients, transfers, retention, security measures), subject to limited exemptions for organisations under 250 employees.",
    chapter: "IV - Controller and processor",
    category: "Controller Obligations",
    weight: 2,
    actor: ["controller", "processor"],
    reference: "GDPR Article 30",
  },
  {
    controlId: "Art.31",
    articleNumber: 31,
    controlName: "Cooperation with the supervisory authority",
    description:
      "The controller and processor (and any representative) must cooperate, on request, with the supervisory authority in the performance of its tasks.",
    chapter: "IV - Controller and processor",
    category: "Controller Obligations",
    weight: 1,
    actor: ["controller", "processor", "authority"],
    reference: "GDPR Article 31",
  },

  // Section 2 - Security of personal data (Art 32-34)
  {
    controlId: "Art.32",
    articleNumber: 32,
    controlName: "Security of processing",
    description:
      "Controllers and processors must implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk (including pseudonymisation/encryption, ongoing confidentiality/integrity/availability/resilience, restoration after incident, regular testing and evaluation).",
    chapter: "IV - Controller and processor",
    category: "Security",
    weight: 3,
    actor: ["controller", "processor"],
    reference: "GDPR Article 32",
  },
  {
    controlId: "Art.33",
    articleNumber: 33,
    controlName: "Notification of a personal data breach to the supervisory authority",
    description:
      "In the case of a personal data breach, the controller must notify the competent supervisory authority without undue delay and, where feasible, not later than 72 hours after becoming aware of it, unless the breach is unlikely to result in a risk to individuals; processors must notify the controller without undue delay.",
    chapter: "IV - Controller and processor",
    category: "Breach Notification",
    weight: 3,
    actor: ["controller", "processor", "authority"],
    reference: "GDPR Article 33",
  },
  {
    controlId: "Art.34",
    articleNumber: 34,
    controlName: "Communication of a personal data breach to the data subject",
    description:
      "When a personal data breach is likely to result in a high risk to the rights and freedoms of natural persons, the controller must communicate the breach to the data subject without undue delay in clear and plain language, subject to defined exceptions.",
    chapter: "IV - Controller and processor",
    category: "Breach Notification",
    weight: 3,
    actor: ["controller", "data_subject"],
    reference: "GDPR Article 34",
  },

  // Section 3 - Data protection impact assessment and prior consultation (Art 35-36)
  {
    controlId: "Art.35",
    articleNumber: 35,
    controlName: "Data protection impact assessment",
    description:
      "Where processing is likely to result in a high risk to the rights and freedoms of natural persons (in particular new technologies, large-scale systematic monitoring, special-category data at scale), the controller must carry out a DPIA prior to processing, with specified content.",
    chapter: "IV - Controller and processor",
    category: "DPIA & Prior Consultation",
    weight: 2,
    actor: ["controller"],
    reference: "GDPR Article 35",
  },
  {
    controlId: "Art.36",
    articleNumber: 36,
    controlName: "Prior consultation",
    description:
      "The controller must consult the supervisory authority prior to processing where a DPIA indicates that processing would result in a high risk in the absence of measures taken by the controller to mitigate the risk.",
    chapter: "IV - Controller and processor",
    category: "DPIA & Prior Consultation",
    weight: 2,
    actor: ["controller", "authority"],
    reference: "GDPR Article 36",
  },

  // Section 4 - Data protection officer (Art 37-39)
  {
    controlId: "Art.37",
    articleNumber: 37,
    controlName: "Designation of the data protection officer",
    description:
      "Controllers and processors must designate a DPO where processing is carried out by a public authority, or core activities consist of large-scale regular and systematic monitoring, or large-scale processing of special-category or criminal data; designation may be shared within a group.",
    chapter: "IV - Controller and processor",
    category: "DPO",
    weight: 2,
    actor: ["controller", "processor"],
    reference: "GDPR Article 37",
  },
  {
    controlId: "Art.38",
    articleNumber: 38,
    controlName: "Position of the data protection officer",
    description:
      "The DPO must be involved in all issues relating to protection of personal data in a proper and timely manner, be provided with necessary resources and independence, report to the highest management level, and not receive instructions regarding the exercise of those tasks.",
    chapter: "IV - Controller and processor",
    category: "DPO",
    weight: 2,
    actor: ["controller", "processor"],
    reference: "GDPR Article 38",
  },
  {
    controlId: "Art.39",
    articleNumber: 39,
    controlName: "Tasks of the data protection officer",
    description:
      "The DPO's tasks include informing and advising the controller/processor and employees, monitoring compliance, providing advice on DPIAs, cooperating with the supervisory authority and acting as the contact point.",
    chapter: "IV - Controller and processor",
    category: "DPO",
    weight: 2,
    actor: ["controller", "processor"],
    reference: "GDPR Article 39",
  },

  // Section 5 - Codes of conduct and certification (Art 40-43)
  {
    controlId: "Art.40",
    articleNumber: 40,
    controlName: "Codes of conduct",
    description:
      "Member States, supervisory authorities, the Board and the Commission must encourage the drawing up of codes of conduct intended to contribute to the proper application of the Regulation for specific processing sectors, with specified approval and monitoring procedures.",
    chapter: "IV - Controller and processor",
    category: "Codes & Certification",
    weight: 1,
    actor: ["controller", "processor", "authority"],
    reference: "GDPR Article 40",
  },
  {
    controlId: "Art.41",
    articleNumber: 41,
    controlName: "Monitoring of approved codes of conduct",
    description:
      "Monitoring of compliance with a code of conduct may be carried out by a body accredited by the competent supervisory authority, which must have an appropriate level of expertise, independence and defined procedures.",
    chapter: "IV - Controller and processor",
    category: "Codes & Certification",
    weight: 1,
    actor: ["authority"],
    reference: "GDPR Article 41",
  },
  {
    controlId: "Art.42",
    articleNumber: 42,
    controlName: "Certification",
    description:
      "Member States, supervisory authorities, the Board and the Commission must encourage the establishment of data protection certification mechanisms, seals and marks to demonstrate compliance with the Regulation; certification is voluntary and does not reduce responsibility.",
    chapter: "IV - Controller and processor",
    category: "Codes & Certification",
    weight: 1,
    actor: ["controller", "processor", "authority"],
    reference: "GDPR Article 42",
  },
  {
    controlId: "Art.43",
    articleNumber: 43,
    controlName: "Certification bodies",
    description:
      "Certification bodies must have an appropriate level of expertise and be accredited by the competent supervisory authority and/or the national accreditation body; accreditation is for a maximum of five years and may be renewed under the same conditions.",
    chapter: "IV - Controller and processor",
    category: "Codes & Certification",
    weight: 1,
    actor: ["authority"],
    reference: "GDPR Article 43",
  },

  // Chapter V - Transfers of personal data to third countries or international organisations (Art 44-50)
  {
    controlId: "Art.44",
    articleNumber: 44,
    controlName: "General principle for transfers",
    description:
      "Any transfer of personal data undergoing processing or intended for processing after transfer to a third country or international organisation may take place only if the conditions of Chapter V are complied with, so that the level of protection guaranteed by the Regulation is not undermined.",
    chapter: "V - Transfers to third countries",
    category: "International Transfers",
    weight: 2,
    actor: ["controller", "processor"],
    reference: "GDPR Article 44",
  },
  {
    controlId: "Art.45",
    articleNumber: 45,
    controlName: "Transfers on the basis of an adequacy decision",
    description:
      "Transfers may take place where the Commission has decided that the third country, territory, sector or international organisation ensures an adequate level of protection; such decisions are subject to periodic review (at least every four years).",
    chapter: "V - Transfers to third countries",
    category: "International Transfers",
    weight: 2,
    actor: ["controller", "processor", "authority"],
    reference: "GDPR Article 45",
  },
  {
    controlId: "Art.46",
    articleNumber: 46,
    controlName: "Transfers subject to appropriate safeguards",
    description:
      "In the absence of an adequacy decision, transfers may take place only if the controller or processor has provided appropriate safeguards (e.g., legally binding instrument, BCRs, standard contractual clauses, approved codes of conduct, approved certification) and enforceable data subject rights/effective remedies are available.",
    chapter: "V - Transfers to third countries",
    category: "International Transfers",
    weight: 2,
    actor: ["controller", "processor"],
    reference: "GDPR Article 46",
  },
  {
    controlId: "Art.47",
    articleNumber: 47,
    controlName: "Binding corporate rules",
    description:
      "The competent supervisory authority must approve binding corporate rules (BCRs) that are legally binding on and enforced by every member of a group of undertakings or enterprises engaged in a joint economic activity, expressly confer enforceable rights on data subjects, and fulfil the specified minimum content requirements.",
    chapter: "V - Transfers to third countries",
    category: "International Transfers",
    weight: 2,
    actor: ["controller", "processor", "authority"],
    reference: "GDPR Article 47",
  },
  {
    controlId: "Art.48",
    articleNumber: 48,
    controlName: "Transfers or disclosures not authorised by Union law",
    description:
      "Any judgment of a court or tribunal and any decision of a third-country administrative authority requiring a controller or processor to transfer or disclose personal data may only be recognised or enforceable if based on an international agreement (e.g., mutual legal assistance treaty) in force between the third country and the Union or a Member State.",
    chapter: "V - Transfers to third countries",
    category: "International Transfers",
    weight: 2,
    actor: ["controller", "processor", "authority"],
    reference: "GDPR Article 48",
  },
  {
    controlId: "Art.49",
    articleNumber: 49,
    controlName: "Derogations for specific situations",
    description:
      "In the absence of an adequacy decision or appropriate safeguards, transfers may only take place on the basis of listed derogations (explicit consent, contract necessity, important public interest, legal claims, vital interests, public register, or limited non-repetitive transfers for compelling legitimate interests).",
    chapter: "V - Transfers to third countries",
    category: "International Transfers",
    weight: 2,
    actor: ["controller", "processor", "data_subject"],
    reference: "GDPR Article 49",
  },
  {
    controlId: "Art.50",
    articleNumber: 50,
    controlName: "International cooperation for the protection of personal data",
    description:
      "The Commission and supervisory authorities must take appropriate steps to develop international cooperation mechanisms, provide international mutual assistance in the enforcement of personal data protection legislation, engage relevant stakeholders, and promote the exchange and documentation of data protection legislation and practice.",
    chapter: "V - Transfers to third countries",
    category: "International Transfers",
    weight: 1,
    actor: ["authority"],
    reference: "GDPR Article 50",
  },
];
