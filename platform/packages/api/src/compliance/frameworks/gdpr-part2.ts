// GDPR Articles 51-99 (EU Regulation 2016/679)
// Source: gdpr-info.eu / eur-lex.europa.eu (public)

export interface GdprControl {
  controlId: string;
  articleNumber: number;
  controlName: string;
  description: string;
  chapter: string;
  category: string;
  weight: 1 | 2 | 3;
  actor: ("controller" | "processor" | "data_subject" | "authority")[];
  reference: string;
}

export const gdpr_part2: GdprControl[] = [
  // ==========================================================================
  // Chapter VI - Independent supervisory authorities (Art 51-59)
  // ==========================================================================
  {
    controlId: "GDPR-ART-51",
    articleNumber: 51,
    controlName: "Supervisory authority",
    description:
      "Each Member State shall provide for one or more independent public authorities to be responsible for monitoring the application of the Regulation, in order to protect fundamental rights and freedoms of natural persons in relation to processing and to facilitate the free flow of personal data within the Union.",
    chapter: "Chapter VI - Independent supervisory authorities",
    category: "Supervisory authority establishment",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 51",
  },
  {
    controlId: "GDPR-ART-52",
    articleNumber: 52,
    controlName: "Independence",
    description:
      "Each supervisory authority shall act with complete independence in performing its tasks and exercising its powers, remain free from external influence, and be provided with the human, technical, financial resources, premises and infrastructure necessary for the effective performance of its tasks and powers.",
    chapter: "Chapter VI - Independent supervisory authorities",
    category: "Supervisory authority independence",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 52",
  },
  {
    controlId: "GDPR-ART-53",
    articleNumber: 53,
    controlName: "General conditions for the members of the supervisory authority",
    description:
      "Member States shall provide for each member of their supervisory authorities to be appointed by means of a transparent procedure, by their parliament, government, head of State, or an independent body entrusted with the appointment under Member State law.",
    chapter: "Chapter VI - Independent supervisory authorities",
    category: "Supervisory authority governance",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 53",
  },
  {
    controlId: "GDPR-ART-54",
    articleNumber: 54,
    controlName: "Rules on the establishment of the supervisory authority",
    description:
      "Each Member State shall provide by law for the establishment of each supervisory authority, including its qualifications and eligibility conditions, rules and procedures for appointment, duration of term (at least four years), whether and how many terms members may be reappointed, and conditions governing obligations of members and staff including professional secrecy.",
    chapter: "Chapter VI - Independent supervisory authorities",
    category: "Supervisory authority governance",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 54",
  },
  {
    controlId: "GDPR-ART-55",
    articleNumber: 55,
    controlName: "Competence",
    description:
      "Each supervisory authority shall be competent for the performance of the tasks assigned to, and for the exercise of the powers conferred on, it in accordance with the Regulation on the territory of its own Member State. Supervisory authorities shall not be competent to supervise processing operations of courts acting in their judicial capacity.",
    chapter: "Chapter VI - Independent supervisory authorities",
    category: "Supervisory authority competence",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 55",
  },
  {
    controlId: "GDPR-ART-56",
    articleNumber: 56,
    controlName: "Competence of the lead supervisory authority",
    description:
      "The supervisory authority of the main establishment or of the single establishment of the controller or processor shall be competent to act as lead supervisory authority for the cross-border processing carried out by that controller or processor, in accordance with the cooperation procedure in Article 60.",
    chapter: "Chapter VI - Independent supervisory authorities",
    category: "One-stop-shop mechanism",
    weight: 2,
    actor: ["authority", "controller", "processor"],
    reference: "GDPR Article 56",
  },
  {
    controlId: "GDPR-ART-57",
    articleNumber: 57,
    controlName: "Tasks",
    description:
      "Without prejudice to other tasks, each supervisory authority shall on its territory monitor and enforce the application of the Regulation, promote public awareness and understanding, advise parliament/government, handle complaints, cooperate with other authorities, conduct investigations, promote awareness among controllers and processors, and perform tasks related to protection of personal data. Tasks shall be performed free of charge.",
    chapter: "Chapter VI - Independent supervisory authorities",
    category: "Supervisory authority tasks",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 57",
  },
  {
    controlId: "GDPR-ART-58",
    articleNumber: 58,
    controlName: "Powers",
    description:
      "Each supervisory authority shall have investigative powers (order controllers/processors to provide information, carry out audits, obtain access to personal data and premises), corrective powers (issue warnings, reprimands, order compliance, impose administrative fines, suspend data flows), authorisation and advisory powers, and the power to bring infringements to judicial authorities and engage in legal proceedings.",
    chapter: "Chapter VI - Independent supervisory authorities",
    category: "Supervisory authority powers",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 58",
  },
  {
    controlId: "GDPR-ART-59",
    articleNumber: 59,
    controlName: "Activity reports",
    description:
      "Each supervisory authority shall draw up an annual report on its activities, which may include a list of types of infringement notified and types of measures taken. Those reports shall be transmitted to the national parliament, the government and other authorities designated by Member State law, and shall be made available to the public, the Commission and the Board.",
    chapter: "Chapter VI - Independent supervisory authorities",
    category: "Supervisory authority transparency",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 59",
  },

  // ==========================================================================
  // Chapter VII - Cooperation and consistency (Art 60-76)
  // ==========================================================================
  {
    controlId: "GDPR-ART-60",
    articleNumber: 60,
    controlName: "Cooperation between the lead supervisory authority and the other supervisory authorities concerned",
    description:
      "The lead supervisory authority shall cooperate with the other supervisory authorities concerned in accordance with this Article in an endeavour to reach consensus. The lead supervisory authority and the supervisory authorities concerned shall exchange all relevant information with each other.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "Cross-border cooperation",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 60",
  },
  {
    controlId: "GDPR-ART-61",
    articleNumber: 61,
    controlName: "Mutual assistance",
    description:
      "Supervisory authorities shall provide each other with relevant information and mutual assistance in order to implement and apply the Regulation consistently, including information requests and supervisory measures, such as requests to carry out prior authorisations, inspections and investigations.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "Cross-border cooperation",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 61",
  },
  {
    controlId: "GDPR-ART-62",
    articleNumber: 62,
    controlName: "Joint operations of supervisory authorities",
    description:
      "The supervisory authorities shall, where appropriate, conduct joint operations, including joint investigations and joint enforcement measures in which members or staff of the supervisory authorities of other Member States are involved.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "Cross-border cooperation",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 62",
  },
  {
    controlId: "GDPR-ART-63",
    articleNumber: 63,
    controlName: "Consistency mechanism",
    description:
      "In order to contribute to the consistent application of this Regulation throughout the Union, the supervisory authorities shall cooperate with each other and, where relevant, with the Commission, through the consistency mechanism as set out in this Section.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "Consistency mechanism",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 63",
  },
  {
    controlId: "GDPR-ART-64",
    articleNumber: 64,
    controlName: "Opinion of the Board",
    description:
      "The European Data Protection Board shall issue an opinion whenever a competent supervisory authority intends to adopt measures concerning processing operations with cross-border effects, including adopting lists of processing operations subject to DPIA, approving codes of conduct, approving certification criteria, approving standard contractual clauses, and authorising BCRs.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "Consistency mechanism",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 64",
  },
  {
    controlId: "GDPR-ART-65",
    articleNumber: 65,
    controlName: "Dispute resolution by the Board",
    description:
      "In order to ensure the correct and consistent application of this Regulation in individual cases, the Board shall adopt a binding decision in cases of conflict between supervisory authorities, such as where an authority concerned raised a relevant and reasoned objection to a draft decision of the lead authority.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "Consistency mechanism",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 65",
  },
  {
    controlId: "GDPR-ART-66",
    articleNumber: 66,
    controlName: "Urgency procedure",
    description:
      "In exceptional circumstances, where a supervisory authority considers that there is an urgent need to act in order to protect the rights and freedoms of data subjects, it may, by way of derogation from the consistency mechanism, immediately adopt provisional measures intended to produce legal effects on its own territory with a specified validity period which shall not exceed three months.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "Consistency mechanism",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 66",
  },
  {
    controlId: "GDPR-ART-67",
    articleNumber: 67,
    controlName: "Exchange of information",
    description:
      "The Commission may adopt implementing acts of general scope in order to specify the arrangements for the exchange of information by electronic means between supervisory authorities, and between supervisory authorities and the Board, in particular the standardised format referred to in Article 64.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "Consistency mechanism",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 67",
  },
  {
    controlId: "GDPR-ART-68",
    articleNumber: 68,
    controlName: "European Data Protection Board",
    description:
      "The European Data Protection Board (EDPB) is hereby established as a body of the Union with legal personality. The Board shall be composed of the head of one supervisory authority of each Member State and of the European Data Protection Supervisor, or their respective representatives.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "European Data Protection Board",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 68",
  },
  {
    controlId: "GDPR-ART-69",
    articleNumber: 69,
    controlName: "Independence",
    description:
      "The Board shall act independently when performing its tasks or exercising its powers pursuant to Articles 70 and 71. Without prejudice to requests by the Commission, the Board shall, in the performance of its tasks or exercise of its powers, neither seek nor take instructions from anybody.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "European Data Protection Board",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 69",
  },
  {
    controlId: "GDPR-ART-70",
    articleNumber: 70,
    controlName: "Tasks of the Board",
    description:
      "The Board shall ensure the consistent application of this Regulation. Tasks include monitoring application, advising the Commission, issuing guidelines, recommendations and best practices, examining any question covering the application of the Regulation, issuing opinions on draft decisions and promoting cooperation and effective bilateral/multilateral exchange of information.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "European Data Protection Board",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 70",
  },
  {
    controlId: "GDPR-ART-71",
    articleNumber: 71,
    controlName: "Reports",
    description:
      "The Board shall draw up an annual report regarding the protection of natural persons with regard to processing in the Union and, where relevant, in third countries and international organisations. The report shall be made public and be transmitted to the European Parliament, the Council and the Commission.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "European Data Protection Board",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 71",
  },
  {
    controlId: "GDPR-ART-72",
    articleNumber: 72,
    controlName: "Procedure",
    description:
      "The Board shall take decisions by a simple majority of its members, unless otherwise provided for in this Regulation. The Board shall adopt its own rules of procedure by a two-thirds majority of its members and organise its own operational arrangements.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "European Data Protection Board",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 72",
  },
  {
    controlId: "GDPR-ART-73",
    articleNumber: 73,
    controlName: "Chair",
    description:
      "The Board shall elect a chair and two deputy chairs from amongst its members by simple majority. The term of office of the Chair and of the deputy chairs shall be five years and be renewable once.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "European Data Protection Board",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 73",
  },
  {
    controlId: "GDPR-ART-74",
    articleNumber: 74,
    controlName: "Tasks of the Chair",
    description:
      "The Chair shall convene the meetings of the Board and prepare its agenda, notify decisions adopted by the Board to the lead supervisory authority and the supervisory authorities concerned, and ensure the timely performance of the tasks of the Board, in particular in relation to the consistency mechanism.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "European Data Protection Board",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 74",
  },
  {
    controlId: "GDPR-ART-75",
    articleNumber: 75,
    controlName: "Secretariat",
    description:
      "The Board shall have a secretariat, which shall be provided by the European Data Protection Supervisor. The secretariat shall perform its tasks exclusively under the instructions of the Chair of the Board and shall provide analytical, administrative and logistical support to the Board.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "European Data Protection Board",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 75",
  },
  {
    controlId: "GDPR-ART-76",
    articleNumber: 76,
    controlName: "Confidentiality",
    description:
      "The discussions of the Board shall be confidential where the Board deems it necessary, as provided for in its rules of procedure. Access to documents submitted to members of the Board, experts and representatives of third parties shall be governed by Regulation (EC) No 1049/2001.",
    chapter: "Chapter VII - Cooperation and consistency",
    category: "European Data Protection Board",
    weight: 2,
    actor: ["authority"],
    reference: "GDPR Article 76",
  },

  // ==========================================================================
  // Chapter VIII - Remedies, liability, penalties (Art 77-84)
  // ==========================================================================
  {
    controlId: "GDPR-ART-77",
    articleNumber: 77,
    controlName: "Right to lodge a complaint with a supervisory authority",
    description:
      "Without prejudice to any other administrative or judicial remedy, every data subject shall have the right to lodge a complaint with a supervisory authority, in particular in the Member State of his or her habitual residence, place of work or place of the alleged infringement, if the data subject considers that the processing of personal data relating to him or her infringes this Regulation.",
    chapter: "Chapter VIII - Remedies, liability and penalties",
    category: "Data subject remedies",
    weight: 3,
    actor: ["data_subject", "authority"],
    reference: "GDPR Article 77",
  },
  {
    controlId: "GDPR-ART-78",
    articleNumber: 78,
    controlName: "Right to an effective judicial remedy against a supervisory authority",
    description:
      "Without prejudice to any other administrative or non-judicial remedy, each natural or legal person shall have the right to an effective judicial remedy against a legally binding decision of a supervisory authority concerning them, including where the supervisory authority does not handle a complaint or does not inform the data subject within three months on the progress or outcome of the complaint.",
    chapter: "Chapter VIII - Remedies, liability and penalties",
    category: "Judicial remedies",
    weight: 3,
    actor: ["data_subject", "controller", "processor", "authority"],
    reference: "GDPR Article 78",
  },
  {
    controlId: "GDPR-ART-79",
    articleNumber: 79,
    controlName: "Right to an effective judicial remedy against a controller or processor",
    description:
      "Without prejudice to any available administrative or non-judicial remedy, each data subject shall have the right to an effective judicial remedy where he or she considers that his or her rights under this Regulation have been infringed as a result of the processing of his or her personal data in non-compliance with this Regulation.",
    chapter: "Chapter VIII - Remedies, liability and penalties",
    category: "Judicial remedies",
    weight: 3,
    actor: ["data_subject", "controller", "processor"],
    reference: "GDPR Article 79",
  },
  {
    controlId: "GDPR-ART-80",
    articleNumber: 80,
    controlName: "Representation of data subjects",
    description:
      "The data subject shall have the right to mandate a not-for-profit body, organisation or association which has been properly constituted in accordance with the law of a Member State, has statutory objectives which are in the public interest, and is active in the field of the protection of data subjects' rights and freedoms, to lodge the complaint on his or her behalf and to exercise rights referred to in Articles 77, 78 and 79.",
    chapter: "Chapter VIII - Remedies, liability and penalties",
    category: "Data subject representation",
    weight: 3,
    actor: ["data_subject"],
    reference: "GDPR Article 80",
  },
  {
    controlId: "GDPR-ART-81",
    articleNumber: 81,
    controlName: "Suspension of proceedings",
    description:
      "Where a competent court of a Member State has information on proceedings, concerning the same subject matter as regards processing by the same controller or processor, that are pending in a court in another Member State, it shall contact that court in the other Member State to confirm the existence of such proceedings, and may suspend its proceedings.",
    chapter: "Chapter VIII - Remedies, liability and penalties",
    category: "Judicial remedies",
    weight: 3,
    actor: ["authority"],
    reference: "GDPR Article 81",
  },
  {
    controlId: "GDPR-ART-82",
    articleNumber: 82,
    controlName: "Right to compensation and liability",
    description:
      "Any person who has suffered material or non-material damage as a result of an infringement of this Regulation shall have the right to receive compensation from the controller or processor for the damage suffered. Any controller involved in processing shall be liable for the damage caused by processing which infringes this Regulation. A processor shall be liable for the damage caused by processing only where it has not complied with obligations specifically directed to processors or where it has acted outside or contrary to lawful instructions of the controller.",
    chapter: "Chapter VIII - Remedies, liability and penalties",
    category: "Liability and compensation",
    weight: 3,
    actor: ["data_subject", "controller", "processor"],
    reference: "GDPR Article 82",
  },
  {
    controlId: "GDPR-ART-83",
    articleNumber: 83,
    controlName: "General conditions for imposing administrative fines",
    description:
      "Each supervisory authority shall ensure that the imposition of administrative fines shall in each individual case be effective, proportionate and dissuasive. Infringements of certain provisions shall be subject to administrative fines up to 10 000 000 EUR, or up to 2% of the total worldwide annual turnover of the preceding financial year, whichever is higher. More serious infringements (e.g. of basic principles, data subject rights, international transfers) shall be subject to fines up to 20 000 000 EUR, or up to 4% of the total worldwide annual turnover, whichever is higher.",
    chapter: "Chapter VIII - Remedies, liability and penalties",
    category: "Administrative fines",
    weight: 3,
    actor: ["authority", "controller", "processor"],
    reference: "GDPR Article 83",
  },
  {
    controlId: "GDPR-ART-84",
    articleNumber: 84,
    controlName: "Penalties",
    description:
      "Member States shall lay down the rules on other penalties applicable to infringements of this Regulation, in particular for infringements which are not subject to administrative fines pursuant to Article 83, and shall take all measures necessary to ensure that they are implemented. Such penalties shall be effective, proportionate and dissuasive.",
    chapter: "Chapter VIII - Remedies, liability and penalties",
    category: "Penalties",
    weight: 3,
    actor: ["authority", "controller", "processor"],
    reference: "GDPR Article 84",
  },

  // ==========================================================================
  // Chapter IX - Specific processing situations (Art 85-91)
  // ==========================================================================
  {
    controlId: "GDPR-ART-85",
    articleNumber: 85,
    controlName: "Processing and freedom of expression and information",
    description:
      "Member States shall by law reconcile the right to the protection of personal data pursuant to this Regulation with the right to freedom of expression and information, including processing for journalistic purposes and the purposes of academic, artistic or literary expression. Member States shall provide for exemptions or derogations from certain Chapters of the Regulation where necessary to reconcile these rights.",
    chapter: "Chapter IX - Provisions relating to specific processing situations",
    category: "Freedom of expression",
    weight: 1,
    actor: ["controller", "authority"],
    reference: "GDPR Article 85",
  },
  {
    controlId: "GDPR-ART-86",
    articleNumber: 86,
    controlName: "Processing and public access to official documents",
    description:
      "Personal data in official documents held by a public authority or a public body or a private body for the performance of a task carried out in the public interest may be disclosed by the authority or body in accordance with Union or Member State law to which the public authority or body is subject, in order to reconcile public access to official documents with the right to the protection of personal data.",
    chapter: "Chapter IX - Provisions relating to specific processing situations",
    category: "Public access to documents",
    weight: 1,
    actor: ["controller", "authority"],
    reference: "GDPR Article 86",
  },
  {
    controlId: "GDPR-ART-87",
    articleNumber: 87,
    controlName: "Processing of the national identification number",
    description:
      "Member States may further determine the specific conditions for the processing of a national identification number or any other identifier of general application. In that case the national identification number or any other identifier of general application shall be used only under appropriate safeguards for the rights and freedoms of the data subject pursuant to this Regulation.",
    chapter: "Chapter IX - Provisions relating to specific processing situations",
    category: "National identifiers",
    weight: 1,
    actor: ["controller", "authority"],
    reference: "GDPR Article 87",
  },
  {
    controlId: "GDPR-ART-88",
    articleNumber: 88,
    controlName: "Processing in the context of employment",
    description:
      "Member States may, by law or by collective agreements, provide for more specific rules to ensure the protection of the rights and freedoms in respect of the processing of employees' personal data in the employment context, in particular for purposes of recruitment, performance of the contract of employment, management, planning and organisation of work, equality and diversity in the workplace, health and safety at work, and termination of the employment relationship.",
    chapter: "Chapter IX - Provisions relating to specific processing situations",
    category: "Employment processing",
    weight: 1,
    actor: ["controller", "authority"],
    reference: "GDPR Article 88",
  },
  {
    controlId: "GDPR-ART-89",
    articleNumber: 89,
    controlName: "Safeguards and derogations relating to processing for archiving purposes in the public interest, scientific or historical research purposes or statistical purposes",
    description:
      "Processing for archiving purposes in the public interest, scientific or historical research purposes or statistical purposes, shall be subject to appropriate safeguards for the rights and freedoms of the data subject. Those safeguards shall ensure that technical and organisational measures are in place in particular in order to ensure respect for the principle of data minimisation, which may include pseudonymisation.",
    chapter: "Chapter IX - Provisions relating to specific processing situations",
    category: "Research and archiving",
    weight: 1,
    actor: ["controller", "authority"],
    reference: "GDPR Article 89",
  },
  {
    controlId: "GDPR-ART-90",
    articleNumber: 90,
    controlName: "Obligations of secrecy",
    description:
      "Member States may adopt specific rules to set out the powers of the supervisory authorities laid down in points (e) and (f) of Article 58(1) in relation to controllers or processors that are subject, under Union or Member State law or rules established by national competent bodies, to an obligation of professional secrecy or other equivalent obligations of secrecy where this is necessary and proportionate to reconcile the right of the protection of personal data with the obligation of secrecy.",
    chapter: "Chapter IX - Provisions relating to specific processing situations",
    category: "Professional secrecy",
    weight: 1,
    actor: ["controller", "processor", "authority"],
    reference: "GDPR Article 90",
  },
  {
    controlId: "GDPR-ART-91",
    articleNumber: 91,
    controlName: "Existing data protection rules of churches and religious associations",
    description:
      "Where in a Member State, churches and religious associations or communities apply, at the time of entry into force of this Regulation, comprehensive rules relating to the protection of natural persons with regard to processing, such rules may continue to apply, provided that they are brought into line with this Regulation. An independent supervisory authority for such churches or associations may be established.",
    chapter: "Chapter IX - Provisions relating to specific processing situations",
    category: "Religious associations",
    weight: 1,
    actor: ["controller", "authority"],
    reference: "GDPR Article 91",
  },

  // ==========================================================================
  // Chapter X - Delegated acts and implementing acts (Art 92-93)
  // ==========================================================================
  {
    controlId: "GDPR-ART-92",
    articleNumber: 92,
    controlName: "Exercise of the delegation",
    description:
      "The power to adopt delegated acts is conferred on the Commission subject to the conditions laid down in this Article. The delegation of power referred to in Article 12(8) and Article 43(8) shall be conferred on the Commission for an indeterminate period of time from 24 May 2016. The delegation may be revoked at any time by the European Parliament or by the Council.",
    chapter: "Chapter X - Delegated acts and implementing acts",
    category: "Delegated acts",
    weight: 1,
    actor: ["authority"],
    reference: "GDPR Article 92",
  },
  {
    controlId: "GDPR-ART-93",
    articleNumber: 93,
    controlName: "Committee procedure",
    description:
      "The Commission shall be assisted by a committee. That committee shall be a committee within the meaning of Regulation (EU) No 182/2011. Where reference is made to this paragraph, Article 5 of Regulation (EU) No 182/2011 shall apply for examination procedure, and Article 8 in conjunction with Article 5 thereof shall apply for urgency procedure.",
    chapter: "Chapter X - Delegated acts and implementing acts",
    category: "Committee procedure",
    weight: 1,
    actor: ["authority"],
    reference: "GDPR Article 93",
  },

  // ==========================================================================
  // Chapter XI - Final provisions (Art 94-99)
  // ==========================================================================
  {
    controlId: "GDPR-ART-94",
    articleNumber: 94,
    controlName: "Repeal of Directive 95/46/EC",
    description:
      "Directive 95/46/EC is repealed with effect from 25 May 2018. References to the repealed Directive shall be construed as references to this Regulation. References to the Working Party on the Protection of Individuals with regard to the Processing of Personal Data established by Article 29 of Directive 95/46/EC shall be construed as references to the European Data Protection Board established by this Regulation.",
    chapter: "Chapter XI - Final provisions",
    category: "Repeal of prior law",
    weight: 1,
    actor: ["authority"],
    reference: "GDPR Article 94",
  },
  {
    controlId: "GDPR-ART-95",
    articleNumber: 95,
    controlName: "Relationship with Directive 2002/58/EC",
    description:
      "This Regulation shall not impose additional obligations on natural or legal persons in relation to processing in connection with the provision of publicly available electronic communications services in public communication networks in the Union in relation to matters for which they are subject to specific obligations with the same objective set out in Directive 2002/58/EC (ePrivacy Directive).",
    chapter: "Chapter XI - Final provisions",
    category: "Relationship with other EU law",
    weight: 1,
    actor: ["controller", "processor", "authority"],
    reference: "GDPR Article 95",
  },
  {
    controlId: "GDPR-ART-96",
    articleNumber: 96,
    controlName: "Relationship with previously concluded Agreements",
    description:
      "International agreements involving the transfer of personal data to third countries or international organisations which were concluded by Member States prior to 24 May 2016, and which comply with Union law as applicable prior to that date, shall remain in force until amended, replaced or revoked.",
    chapter: "Chapter XI - Final provisions",
    category: "Pre-existing agreements",
    weight: 1,
    actor: ["authority"],
    reference: "GDPR Article 96",
  },
  {
    controlId: "GDPR-ART-97",
    articleNumber: 97,
    controlName: "Commission reports",
    description:
      "By 25 May 2020 and every four years thereafter, the Commission shall submit a report on the evaluation and review of this Regulation to the European Parliament and to the Council. The reports shall be made public. The reports shall examine in particular the application and functioning of Chapter V on the transfer of personal data to third countries and of Chapter VII on cooperation and consistency.",
    chapter: "Chapter XI - Final provisions",
    category: "Evaluation and review",
    weight: 1,
    actor: ["authority"],
    reference: "GDPR Article 97",
  },
  {
    controlId: "GDPR-ART-98",
    articleNumber: 98,
    controlName: "Review of other Union legal acts on data protection",
    description:
      "The Commission shall, if appropriate, submit legislative proposals with a view to amending other Union legal acts on the protection of personal data, in order to ensure uniform and consistent protection of natural persons with regard to processing. This shall in particular concern the rules relating to the protection of natural persons with regard to processing by Union institutions, bodies, offices and agencies and on the free movement of such data.",
    chapter: "Chapter XI - Final provisions",
    category: "Review of Union law",
    weight: 1,
    actor: ["authority"],
    reference: "GDPR Article 98",
  },
  {
    controlId: "GDPR-ART-99",
    articleNumber: 99,
    controlName: "Entry into force and application",
    description:
      "This Regulation shall enter into force on the twentieth day following that of its publication in the Official Journal of the European Union. It shall apply from 25 May 2018. This Regulation shall be binding in its entirety and directly applicable in all Member States.",
    chapter: "Chapter XI - Final provisions",
    category: "Entry into force",
    weight: 1,
    actor: ["authority", "controller", "processor", "data_subject"],
    reference: "GDPR Article 99",
  },
];
