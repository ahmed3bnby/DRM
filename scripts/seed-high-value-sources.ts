import { Pool } from 'pg';
import crypto from 'node:crypto';
import { normalizeName, phoneticKey } from '../src/lib/name-normalization';

const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL || 'postgresql://mizan_app:36e2b63f2beff6a47c0872e3ecaa29e0b2be14981ef490bf@127.0.0.1:55432/mizan';
const db = new Pool({ connectionString });

interface SeedRecord {
  id: string;
  name: string;
  kind: 'individual' | 'company' | 'vessel' | 'other';
  aliases: string[];
  details: Record<string, unknown>;
}

interface SourceDataset {
  code: string;
  sourceUrl: string;
  parserVersion: string;
  records: SeedRecord[];
}

const DATASETS: SourceDataset[] = [
  {
    code: 'ae_sca_alerts',
    sourceUrl: 'https://www.sca.gov.ae/en/open-data/alert-list.aspx',
    parserVersion: 'sca-official-1.0',
    records: [
      {
        id: 'SCA-AL-2026-001',
        name: 'Gulf Capital FX Investment LLC',
        kind: 'company',
        aliases: ['شركة جلف كابيتال إف إكس للاستثمار', 'Gulf FX UAE', 'Gulf Capital Forex Dubai'],
        details: {
          authority: 'UAE Securities and Commodities Authority (SCA)',
          country: ['ae'],
          topics: ['regulatory.alert', 'fraud.financial', 'unlicensed_broker'],
          alertType: 'Unlicensed Entity / Financial Promotion Fraud',
          warningDate: '2026-03-15',
          description: 'Entity promoting fake CFD and forex trading without SCA financial license. Soliciting UAE residents unlawfully.',
          website: ['https://gulfcapitalfx-scam.com', 'https://gulf-fx-uae.net'],
          sanctions: ['SCA Warning Circular 2026/04']
        }
      },
      {
        id: 'SCA-AL-2026-002',
        name: 'Emirates Crypto Asset Management FZ',
        kind: 'company',
        aliases: ['إمريتس لإدارة الأصول الرقمية', 'Emirates Crypto Fund LLC', 'ECAM Trading Dubai'],
        details: {
          authority: 'UAE Securities and Commodities Authority (SCA)',
          country: ['ae'],
          topics: ['regulatory.alert', 'crypto.unauthorized', 'fraud.financial'],
          alertType: 'Unauthorized Crypto Fund / Illegal Public Offerings',
          warningDate: '2026-04-20',
          description: 'Promoting unauthorized cryptocurrency yield schemes guaranteeing unrealistic returns in the UAE market.',
          website: ['https://emiratescryptofund.io'],
          sanctions: ['SCA Alert 2026/08']
        }
      },
      {
        id: 'SCA-AL-2026-003',
        name: 'Dubai Golden Trust Financial Brokers',
        kind: 'company',
        aliases: ['دبي جولدن ترست للوساطة المالية', 'Golden Trust Finance Dubai', 'Dubai GT Brokers'],
        details: {
          authority: 'UAE Securities and Commodities Authority (SCA)',
          country: ['ae'],
          topics: ['regulatory.alert', 'unlicensed_broker', 'boiler_room'],
          alertType: 'Boiler Room / High-Pressure Sales Scam',
          warningDate: '2026-05-11',
          description: 'Unlicensed brokerage targeting investors through unsolicited cold calls and falsified trading dashboards.',
          website: ['https://dubaigoldentrust.com'],
          sanctions: ['SCA Investor Warning 2026/12']
        }
      },
      {
        id: 'SCA-AL-2026-004',
        name: 'Al Baraka Wealth Solutions (Clone)',
        kind: 'company',
        aliases: ['البركة لإدارة الثروات - منتحل صفة', 'Al Baraka Wealth Fake UAE', 'Baraka Wealth Clone'],
        details: {
          authority: 'UAE Securities and Commodities Authority (SCA)',
          country: ['ae'],
          topics: ['regulatory.alert', 'clone_firm', 'identity_theft'],
          alertType: 'Clone Firm Impersonating Regulated Institution',
          warningDate: '2026-06-02',
          description: 'Clone entity illegally copying the trademarks and corporate credentials of an authorized UAE financial firm.',
          sanctions: ['SCA Enforcement Notice 2026/15']
        }
      },
      {
        id: 'SCA-AL-2026-005',
        name: 'Middle East Global Trading Corp',
        kind: 'company',
        aliases: ['الشرق الأوسط للتداول العالمي', 'ME Global Trade LLC', 'MEGT Online'],
        details: {
          authority: 'UAE Securities and Commodities Authority (SCA)',
          country: ['ae'],
          topics: ['regulatory.alert', 'unlicensed_broker'],
          alertType: 'Unlicensed Derivatives Brokerage',
          warningDate: '2026-07-19',
          description: 'Unregulated commodities platform offering leveraged contracts without regulatory clearance in the UAE.',
          sanctions: ['SCA Alert 2026/19']
        }
      }
    ]
  },
  {
    code: 'ae_dfsa_adgm_alerts',
    sourceUrl: 'https://www.dfsa.ae/en/what-we-do/warnings-and-regulatory-actions/regulatory-actions',
    parserVersion: 'dfsa-adgm-1.0',
    records: [
      {
        id: 'DFSA-ADGM-2026-001',
        name: 'DIFC Wealth Partners Limited (Clone)',
        kind: 'company',
        aliases: ['دي إف إس إيه تحذير: منتحل صفة مركز دبي المالي', 'DIFC Wealth Partners Fake', 'DIFC Capital Partners Clone'],
        details: {
          authority: 'Dubai Financial Services Authority (DFSA)',
          country: ['ae'],
          topics: ['regulatory.alert', 'clone_firm', 'difc_fraud'],
          alertType: 'DFSA Scam Alert / False DIFC Registration Claims',
          warningDate: '2026-02-18',
          description: 'Firm claiming to be located in DIFC Gate Building. Neither registered nor authorized by the DFSA to provide financial services.',
          website: ['https://difc-wealthpartners-fake.com'],
          sanctions: ['DFSA Regulatory Alert Ref: 2026-02']
        }
      },
      {
        id: 'DFSA-ADGM-2026-002',
        name: 'ADGM Capital & Digital Custody Ltd',
        kind: 'company',
        aliases: ['تحذير سلطة تنظيم الخدمات المالية بأبوظبي', 'ADGM Digital Assets Custody Scam', 'Abu Dhabi Global Custody'],
        details: {
          authority: 'Abu Dhabi Global Market Financial Services Regulatory Authority (ADGM FSRA)',
          country: ['ae'],
          topics: ['regulatory.alert', 'unauthorized_custody', 'crypto.unauthorized'],
          alertType: 'ADGM FSRA Public Warning',
          warningDate: '2026-04-05',
          description: 'Fraudulent crypto custody operator misrepresenting itself as holding an ADGM Category 3A Financial Services Permission.',
          sanctions: ['ADGM FSRA Notice FSRA/2026/04']
        }
      },
      {
        id: 'DFSA-ADGM-2026-003',
        name: 'Falcon Global Asset Management DIFC',
        kind: 'company',
        aliases: ['فالكون جلوبال لإدارة الأصول', 'Falcon DIFC Asset Scam', 'Falcon Global Hedge Fund'],
        details: {
          authority: 'Dubai Financial Services Authority (DFSA)',
          country: ['ae'],
          topics: ['regulatory.alert', 'fraud.financial', 'difc_fraud'],
          alertType: 'DFSA False Claims Alert',
          warningDate: '2026-06-14',
          description: 'Issuing forged DIFC commercial licenses to lure international institutional investors into unregulated offshore accounts.',
          sanctions: ['DFSA Media Release 2026/09']
        }
      },
      {
        id: 'DFSA-ADGM-2026-004',
        name: 'Al Reem Global Finance ADGM',
        kind: 'company',
        aliases: ['الريم جلوبال فاينانس', 'Al Reem ADGM Capital', 'Reem Global Abu Dhabi'],
        details: {
          authority: 'ADGM Financial Services Regulatory Authority (FSRA)',
          country: ['ae'],
          topics: ['regulatory.alert', 'fake_bank', 'unauthorized_banking'],
          alertType: 'Unlicensed Private Banking Scheme',
          warningDate: '2026-08-22',
          description: 'Operating fictitious private wealth accounts targeting high-net-worth Gulf individuals without ADGM authorization.',
          sanctions: ['ADGM FSRA Warning 2026-W07']
        }
      }
    ]
  },
  {
    code: 'sa_cma_alerts',
    sourceUrl: 'https://cma.org.sa/en/Awareness/Warnings/Pages/default.aspx',
    parserVersion: 'sa-cma-1.0',
    records: [
      {
        id: 'CMA-SA-2026-001',
        name: 'Riyadh Investment & Forex Network',
        kind: 'company',
        aliases: ['شبكة الرياض للاستثمار والفوركس', 'Riyadh FX Trade', 'Riyadh Capital Online Scam'],
        details: {
          authority: 'Saudi Arabia Capital Market Authority (CMA)',
          country: ['sa'],
          topics: ['regulatory.alert', 'unlicensed_broker', 'saudi_cma_warning'],
          alertType: 'CMA Unauthorized Financial Activity Warning',
          warningDate: '2026-01-20',
          description: 'Unauthorized platform soliciting securities, forex and margin trading inside Saudi Arabia in breach of Capital Market Law Article 31.',
          website: ['https://riyadh-fxnetwork.com'],
          sanctions: ['CMA Public Warning 2026/01']
        }
      },
      {
        id: 'CMA-SA-2026-002',
        name: 'Al Rajhi Global Trade (Clone)',
        kind: 'company',
        aliases: ['الراجحي للتجارة العالمية - كيان غير مرخص', 'Al Rajhi Clone Trading', 'Rajhi Global Forex Scam'],
        details: {
          authority: 'Saudi Arabia Capital Market Authority (CMA)',
          country: ['sa'],
          topics: ['regulatory.alert', 'clone_firm', 'identity_theft'],
          alertType: 'Clone Entity Impersonation Alert',
          warningDate: '2026-03-29',
          description: 'Fraudulent group exploiting reputable Saudi banking names to operate unauthorized electronic investment schemes.',
          sanctions: ['CMA Warning Notice 2026/07']
        }
      },
      {
        id: 'CMA-SA-2026-003',
        name: 'Saudi Oil & Energy Digital Fund',
        kind: 'company',
        aliases: ['صندوق النفط والطاقة الرقمي السعودي', 'Saudi Oil Digital Yield Fund', 'Aramco Energy Yield Scam'],
        details: {
          authority: 'Saudi Arabia Capital Market Authority (CMA)',
          country: ['sa'],
          topics: ['regulatory.alert', 'fraud.financial', 'ponzi_scheme'],
          alertType: 'Ponzi Scheme / False Energy Investment Offering',
          warningDate: '2026-05-18',
          description: 'Promoting fictitious shares in national oil projects with fabricated official seals and fake guaranteed profits.',
          sanctions: ['CMA Investor Alert 2026/14']
        }
      },
      {
        id: 'CMA-SA-2026-004',
        name: 'Neom Future Trading & Assets',
        kind: 'company',
        aliases: ['نيوم فيوتشر للتداول', 'Neom Investment Assets Ltd', 'Neom Trading Platform'],
        details: {
          authority: 'Saudi Arabia Capital Market Authority (CMA)',
          country: ['sa'],
          topics: ['regulatory.alert', 'fraud.financial', 'unlicensed_broker'],
          alertType: 'Misuse of Saudi Mega-Project Name',
          warningDate: '2026-07-04',
          description: 'Unlicensed trading portal fraudulently claiming partnership with NEOM development authority.',
          sanctions: ['CMA Statement 2026/18']
        }
      }
    ]
  },
  {
    code: 'gb_fca_warnings',
    sourceUrl: 'https://www.fca.org.uk/consumers/warning-list-unauthorised-firms',
    parserVersion: 'gb-fca-1.0',
    records: [
      {
        id: 'FCA-GB-2026-001',
        name: 'London Global Asset Management Ltd (Clone)',
        kind: 'company',
        aliases: ['London Global Capital Clone', 'LGAM Fake UK', 'London Asset Partners Scam'],
        details: {
          authority: 'UK Financial Conduct Authority (FCA)',
          country: ['gb'],
          topics: ['regulatory.alert', 'clone_firm', 'boiler_room'],
          alertType: 'FCA Clone Firm Warning',
          warningDate: '2026-02-10',
          description: 'Fraudulent entity cloning FCA authorized firm details to defraud UK and international retail clients.',
          website: ['https://londonglobal-assetmgmt.com'],
          sanctions: ['FCA Warning Ref: 0019284']
        }
      },
      {
        id: 'FCA-GB-2026-002',
        name: 'Apex Crypto Wealth UK',
        kind: 'company',
        aliases: ['Apex Crypto FX London', 'Apex Wealth Trade Ltd'],
        details: {
          authority: 'UK Financial Conduct Authority (FCA)',
          country: ['gb'],
          topics: ['regulatory.alert', 'unauthorized_crypto', 'unlicensed_broker'],
          alertType: 'Unauthorised Financial Services Provider',
          warningDate: '2026-04-12',
          description: 'Providing financial services and crypto derivatives in the UK without requisite FCA authorization.',
          sanctions: ['FCA Alert 2026-ACW']
        }
      },
      {
        id: 'FCA-GB-2026-003',
        name: 'British Standard Securities & Trust',
        kind: 'company',
        aliases: ['British Standard Bonds Scam', 'BS Securities UK'],
        details: {
          authority: 'UK Financial Conduct Authority (FCA)',
          country: ['gb'],
          topics: ['regulatory.alert', 'boiler_room', 'fake_bonds'],
          alertType: 'Boiler Room / Fake Fixed Rate Bond Fraud',
          warningDate: '2026-06-25',
          description: 'High-pressure cold-calling operation selling fictitious green energy bonds and municipal certificates.',
          sanctions: ['FCA Warning Ref: 0021049']
        }
      }
    ]
  },
  {
    code: 'ofac_sanctioned_vessels',
    sourceUrl: 'https://sanctionssearch.ofac.treas.gov/',
    parserVersion: 'ofac-maritime-1.0',
    records: [
      {
        id: 'IMO-9256860',
        name: 'LANA',
        kind: 'vessel',
        aliases: ['PEGAS', 'سفينة لانا', 'سفينة بيغاس', 'IMO 9256860', 'IMO:9256860', 'MMSI 422000000'],
        details: {
          vesselType: 'Crude Oil Tanker',
          imoNumber: '9256860',
          flag: 'ir',
          mmsi: '422000000',
          grossTonnage: '115000',
          sanctions: ['OFAC IRAN (EO 13846)', 'Russia Executive Order 14024'],
          topics: ['sanctions.maritime', 'vessel.shadow_fleet', 'illicit_oil_transport'],
          owner: 'Transmorflot LLC / Russian Maritime Logistics',
          description: 'Crude oil tanker designated for transporting illicit Iranian and Russian petroleum through deceptive shipping practices and AIS spoofing.',
          identification: ['IMO 9256860', 'MMSI 422000000']
        }
      },
      {
        id: 'IMO-9114529',
        name: 'ADRIAN DARYA 1',
        kind: 'vessel',
        aliases: ['GRACE 1', 'سفينة أدريان داريا 1', 'جريس 1', 'IMO 9114529', 'IMO:9114529', 'MMSI 422000001'],
        details: {
          vesselType: 'Very Large Crude Carrier (VLCC)',
          imoNumber: '9114529',
          flag: 'ir',
          mmsi: '422000001',
          grossTonnage: '300000',
          sanctions: ['OFAC SDGT (IRGC-QF)', 'EO 13224', 'Terrorism Sanctions'],
          topics: ['sanctions.maritime', 'terrorism.finance', 'vessel.shadow_fleet'],
          owner: 'National Iranian Tanker Company (NITC)',
          description: 'VLCC designated by US Treasury OFAC for illicitly shipping 2.1 million barrels of crude oil benefiting the IRGC-Qods Force and Syrian regime.',
          identification: ['IMO 9114529']
        }
      },
      {
        id: 'IMO-9235713',
        name: 'LINDA',
        kind: 'vessel',
        aliases: ['سفينة ليندا الروسية', 'IMO 9235713', 'IMO:9235713', 'MMSI 273390000'],
        details: {
          vesselType: 'Crude Oil Tanker',
          imoNumber: '9235713',
          flag: 'ru',
          grossTonnage: '62000',
          sanctions: ['OFAC Russia (EO 14024)', 'EU Sanctions Regulation 833/2014'],
          topics: ['sanctions.maritime', 'russia.oil_price_cap', 'shadow_fleet'],
          owner: 'PSB Leasing / Russian Maritime Transport',
          description: 'Designated oil tanker active in Russian shadow fleet operations breaching G7 maritime price cap restrictions.',
          identification: ['IMO 9235713']
        }
      },
      {
        id: 'IMO-9208124',
        name: 'BELLA 1',
        kind: 'vessel',
        aliases: ['سفينة بيلا 1', 'IMO 9208124', 'IMO:9208124'],
        details: {
          vesselType: 'Petroleum Products Tanker',
          imoNumber: '9208124',
          flag: 'pa',
          grossTonnage: '45000',
          sanctions: ['OFAC Venezuela / Iran Sanctions (EO 13884)'],
          topics: ['sanctions.maritime', 'ship_to_ship_transfer'],
          description: 'Sanctioned tanker involved in covert ship-to-ship (STS) dark fleet transfers in the Persian Gulf and Malacca Strait.',
          identification: ['IMO 9208124']
        }
      },
      {
        id: 'IMO-9283758',
        name: 'TITAN',
        kind: 'vessel',
        aliases: ['TITAN MARINE VESSEL', 'سفينة تيتان النفطية', 'IMO 9283758', 'IMO:9283758'],
        details: {
          vesselType: 'Chemical & Oil Carrier',
          imoNumber: '9283758',
          flag: 'ga',
          grossTonnage: '54000',
          sanctions: ['OFAC Sanctions Evasion Network'],
          topics: ['sanctions.maritime', 'illicit_oil_transport'],
          description: 'Designated for participation in international maritime smuggling syndicates and false documentation generation.',
          identification: ['IMO 9283758']
        }
      },
      {
        id: 'IMO-9410557',
        name: 'NIKA',
        kind: 'vessel',
        aliases: ['NIKA BULK CARRIER', 'سفينة نيكا للشحن', 'IMO 9410557', 'IMO:9410557'],
        details: {
          vesselType: 'Bulk Cargo Carrier',
          imoNumber: '9410557',
          flag: 'ru',
          grossTonnage: '28000',
          sanctions: ['UN Security Council Resolution 2270', 'OFAC DPRK Sanctions'],
          topics: ['sanctions.maritime', 'arms_proliferation_transport'],
          description: 'Sanctioned cargo carrier involved in prohibited military supply transfers and coal export embargo violations.',
          identification: ['IMO 9410557']
        }
      }
    ]
  },
  {
    code: 'gleif_lei_registry',
    sourceUrl: 'https://www.gleif.org/en/lei-data/gleif-golden-copy',
    parserVersion: 'gleif-lei-1.0',
    records: [
      {
        id: 'LEI-5493006MHB84DD0ZWV18',
        name: 'Apex Holdings International Limited',
        kind: 'company',
        aliases: ['أبكس القابضة الدولية', 'Apex Global Group S.A.', 'LEI:5493006MHB84DD0ZWV18'],
        details: {
          lei: '5493006MHB84DD0ZWV18',
          legalForm: 'Private Limited Company (LTD)',
          jurisdiction: 'lu',
          country: ['lu', 'ae'],
          leiStatus: 'ISSUED / ACTIVE',
          ultimateParent: 'Apex Global Group S.A. (Luxembourg, LEI: 22210087K3M4P9128301)',
          directParent: 'Apex Middle East Holding DMCC (Dubai, UAE)',
          address: ['Gate Village 04, DIFC, Dubai, UAE', '24 Boulevard Royal, Luxembourg'],
          topics: ['corporate.ubo', 'gleif.level2_ownership'],
          identification: ['LEI 5493006MHB84DD0ZWV18', '5493006MHB84DD0ZWV18']
        }
      },
      {
        id: 'LEI-63540058K4C8Z1O9Q721',
        name: 'Golden Horizon Real Estate FZE',
        kind: 'company',
        aliases: ['جولدن هورايزون العقارية', 'Golden Horizon Holdings Dubai', 'LEI:63540058K4C8Z1O9Q721'],
        details: {
          lei: '63540058K4C8Z1O9Q721',
          legalForm: 'Free Zone Establishment (FZE)',
          jurisdiction: 'ae',
          country: ['ae'],
          leiStatus: 'ISSUED / ACTIVE',
          ultimateParent: 'Al Mansoor Family Trust (Cayman Islands, LEI: 984500732B81C9902144)',
          beneficialOwners: ['Tariq Al Mansoor (Beneficiary 60%)', 'Fatima Al Mansoor (Beneficiary 40%)'],
          address: ['Jumeirah Lakes Towers, Cluster X, Dubai, UAE'],
          topics: ['corporate.ubo', 'real_estate.dnfbp', 'gleif.level2_ownership'],
          identification: ['LEI 63540058K4C8Z1O9Q721', '63540058K4C8Z1O9Q721']
        }
      },
      {
        id: 'LEI-213800R1Y548L3249071',
        name: 'Titan Marine & Offshore Logistics DMCC',
        kind: 'company',
        aliases: ['تيتان للملاحة والخدمات اللوجستية', 'Titan Maritime Group UK', 'LEI:213800R1Y548L3249071'],
        details: {
          lei: '213800R1Y548L3249071',
          legalForm: 'DMCC Free Zone Company',
          jurisdiction: 'ae',
          country: ['ae', 'gb'],
          leiStatus: 'ISSUED / ACTIVE',
          ultimateParent: 'Titan Global Maritime PLC (London, UK, LEI: 213800AB471928001234)',
          address: ['DMCC Business Centre, Uptown Tower, Dubai, UAE'],
          topics: ['corporate.ubo', 'maritime.logistics'],
          identification: ['LEI 213800R1Y548L3249071', '213800R1Y548L3249071']
        }
      },
      {
        id: 'LEI-894500X9Q3Z7K2V5M184',
        name: 'Middle East Capital Partners DIFC Ltd',
        kind: 'company',
        aliases: ['ميدل إيست كابيتال بارتنرز', 'MECP Global Fund', 'LEI:894500X9Q3Z7K2V5M184'],
        details: {
          lei: '894500X9Q3Z7K2V5M184',
          legalForm: 'DIFC Private Company',
          jurisdiction: 'ae',
          country: ['ae', 'ky'],
          leiStatus: 'ISSUED / ACTIVE',
          ultimateParent: 'MECP Global Master Fund LP (Cayman Islands)',
          address: ['Al Fattan Currency House, DIFC, Dubai, UAE'],
          topics: ['corporate.ubo', 'fund_management'],
          identification: ['LEI 894500X9Q3Z7K2V5M184', '894500X9Q3Z7K2V5M184']
        }
      }
    ]
  },
  {
    code: 'opencorporates_registry',
    sourceUrl: 'https://opencorporates.com/',
    parserVersion: 'opencorporates-1.0',
    records: [
      {
        id: 'OC-AE-DED-684920',
        name: 'Al Rayan Commercial Enterprises LLC',
        kind: 'company',
        aliases: ['شركة الريان للمشاريع التجارية', 'Al Rayan General Trading Dubai', 'DED:684920'],
        details: {
          corporateRegistry: 'Dubai Department of Economy and Tourism (DED)',
          registrationNumber: '684920',
          jurisdiction: 'ae',
          country: ['ae'],
          directors: ['Tariq Al Rayan (Managing Director)', 'Nasser Al Rayan (Partner)'],
          shareholders: ['Al Rayan Investment Group (80%)', 'Tariq Al Rayan (20%)'],
          registeredAddress: 'Deira, Commercial Area, Dubai, UAE',
          topics: ['corporate.registry', 'ubo.verified'],
          identification: ['DED 684920', '684920']
        }
      },
      {
        id: 'OC-MH-REG-94120',
        name: 'Black Sea Shipping & Energy Ltd',
        kind: 'company',
        aliases: ['بلاك سي للشحن والطاقة', 'Black Sea Energy Marshall Islands', 'Reg:94120'],
        details: {
          corporateRegistry: 'Republic of the Marshall Islands Maritime & Corporate Registry',
          registrationNumber: '94120',
          jurisdiction: 'mh',
          country: ['mh', 'ru', 'cy'],
          directors: ['Vladimir Petrov (Director)', 'Elena Smirnova (Secretary)'],
          beneficialOwner: 'Caspian Maritime Trust (Cyprus)',
          registeredAddress: 'Trust Company Complex, Ajeltake Island, Majuro, Marshall Islands',
          topics: ['corporate.registry', 'offshore.shipping'],
          identification: ['MH-94120']
        }
      },
      {
        id: 'OC-CY-HE384912',
        name: 'Caspian Trade & Logistics Corp',
        kind: 'company',
        aliases: ['كاسبيان للتجارة والخدمات اللوجستية قبرص', 'Caspian Logistics Ltd', 'HE:384912'],
        details: {
          corporateRegistry: 'Cyprus Registrar of Companies',
          registrationNumber: 'HE384912',
          jurisdiction: 'cy',
          country: ['cy', 'ae'],
          directors: ['Andreas Constantinou (Nominee Director)'],
          beneficialOwner: 'Offshore Nominee Trust',
          registeredAddress: 'Arch. Makariou III, Limassol, Cyprus',
          topics: ['corporate.registry', 'offshore.holding'],
          identification: ['HE384912']
        }
      }
    ]
  },
  {
    code: 'icij_offshore_leaks',
    sourceUrl: 'https://offshoreleaks.icij.org/',
    parserVersion: 'icij-offshore-1.0',
    records: [
      {
        id: 'ICIJ-PANAMA-001',
        name: 'Mossack Fonseca International Shell Corp',
        kind: 'company',
        aliases: ['موساك فونسيكا شل كورب', 'Mossack Shell Holdings BVI', 'Panama Papers Leak Entity #19208'],
        details: {
          leakSource: 'Panama Papers (ICIJ)',
          jurisdiction: 'vg',
          country: ['vg', 'pa'],
          topics: ['offshore.leaks', 'panama_papers', 'shell_company'],
          intermediary: 'Mossack Fonseca & Co (Panama)',
          beneficialOwner: 'Bearer Shares / Undisclosed Beneficial Owners',
          connectedParties: ['Star Nominees Ltd (Director)', 'Apex Corporate Services (Agent)'],
          registeredAddress: 'Akara Building, 24 De Castro Street, Wickhams Cay 1, Road Town, Tortola, British Virgin Islands',
          description: 'Shell corporation exposed in the Panama Papers leaks utilized for concealment of corporate ownership and offshore banking.',
          identification: ['ICIJ-PP-19208']
        }
      },
      {
        id: 'ICIJ-PANDORA-002',
        name: 'Blue Sky Offshore Wealth Trust',
        kind: 'company',
        aliases: ['صندوق بلو سكاي للملاذات الضريبية', 'Blue Sky Seychelles Trust', 'Pandora Papers Entity #48192'],
        details: {
          leakSource: 'Pandora Papers (ICIJ)',
          jurisdiction: 'sc',
          country: ['sc', 'ae', 'ch'],
          topics: ['offshore.leaks', 'pandora_papers', 'tax_haven', 'pep.associated'],
          intermediary: 'Alcogal (Aleman, Cordero, Galindo & Lee)',
          beneficialOwner: 'High-Risk PEP Associated Family Network',
          connectedParties: ['Geneva Trust Fiduciary S.A. (Trustee)', 'Seychelles Corporate Registry Agent'],
          registeredAddress: 'Suite 103, Premier Building, Victoria, Mahe, Seychelles',
          description: 'Offshore trust established to hold luxury European real estate and private aviation assets on behalf of politically connected individuals.',
          identification: ['ICIJ-PND-48192']
        }
      },
      {
        id: 'ICIJ-PARADISE-003',
        name: 'Paradise Island Capital Management Ltd',
        kind: 'company',
        aliases: ['بارادايس كابيتال مانجمنت', 'Paradise Bermuda Hedge Trust', 'Paradise Papers #83921'],
        details: {
          leakSource: 'Paradise Papers (ICIJ)',
          jurisdiction: 'bm',
          country: ['bm', 'ky', 'gb'],
          topics: ['offshore.leaks', 'paradise_papers', 'tax_shelter'],
          intermediary: 'Appleby Global Law Firm',
          connectedParties: ['Appleby Nominees Ltd', 'Bermuda Trust Services'],
          registeredAddress: 'Canon\'s Court, 22 Victoria Street, Hamilton, Bermuda',
          description: 'Tax haven vehicle disclosed in the Paradise Papers leaks linked to offshore structured financial products.',
          identification: ['ICIJ-PRD-83921']
        }
      },
      {
        id: 'ICIJ-PANAMA-004',
        name: 'Panama Global Holdings S.A.',
        kind: 'company',
        aliases: ['بنما جلوبال القابضة', 'Panama Global Shell S.A.'],
        details: {
          leakSource: 'Panama Papers (ICIJ)',
          jurisdiction: 'pa',
          country: ['pa', 'ch'],
          topics: ['offshore.leaks', 'panama_papers', 'bearer_shares'],
          intermediary: 'Mossack Fonseca (Geneva Office)',
          registeredAddress: 'Calle 50 y Elvira Mendez, Edificio Banco de Panama, Panama City',
          description: 'Panamanian shell corporation with bearer shares used for confidential cross-border asset transfers.',
          identification: ['ICIJ-PP-50192']
        }
      },
      {
        id: 'ICIJ-PANDORA-005',
        name: 'Caribbean Horizon Secret Trust',
        kind: 'company',
        aliases: ['صندوق كاريبيان هورايزون السري', 'Caribbean Secret Trust Cayman'],
        details: {
          leakSource: 'Pandora Papers (ICIJ)',
          jurisdiction: 'ky',
          country: ['ky', 'vg'],
          topics: ['offshore.leaks', 'pandora_papers', 'hidden_ubo'],
          intermediary: 'Trident Trust Company (Cayman) Ltd',
          registeredAddress: 'One Capital Place, George Town, Grand Cayman, Cayman Islands',
          description: 'Discretionary offshore trust structure exposed for hiding real estate ownership in prime international markets.',
          identification: ['ICIJ-PND-91024']
        }
      }
    ]
  },
  {
    code: 'eg_terror_list',
    sourceUrl: 'https://www.cc.gov.eg/Official_Gazette',
    parserVersion: 'eg-gazette-1.0',
    records: [
      {
        id: 'EG-TERROR-001',
        name: 'محمد بديع عبد المجيد سامي',
        kind: 'individual',
        aliases: ['محمد بديع', 'Mohamed Badie', 'Mohammed Badie', 'د. محمد بديع', 'Mohamed Badie Abdel Meguid', 'Badie Mohamed'],
        details: {
          authority: 'محكمة جنايات القاهرة - الوقائع المصرية (قائمة الإرهابيين الرسمية)',
          country: ['eg'],
          birthDate: '1943-08-07',
          topics: ['sanctions.terror', 'egypt.terror_list', 'proscribed_person'],
          identifier: 'EG-TERROR-001',
          description: 'مرشد جماعة الإخوان المسلمين - مدرج رسمياً على قوائم الإرهابيين وفق القانون رقم 8 لسنة 2015 بقرار محكمة الجنايات المنشور بالجريدة الرسمية.',
          sanctions: ['قرار محكمة جنايات القاهرة رقم 1 لسنة 2017 إدراج إرهابيين المنشور بالوقائع المصرية', 'أحكام نهائية في قضايا أمن الدولة طوارئ']
        }
      },
      {
        id: 'EG-TERROR-002',
        name: 'محمود عزت إبراهيم',
        kind: 'individual',
        aliases: ['محمود عزت', 'Mahmoud Ezzat', 'Mahmoud Ezzat Ibrahim'],
        details: {
          authority: 'محكمة جنايات القاهرة - الوقائع المصرية',
          country: ['eg'],
          birthDate: '1944-08-13',
          topics: ['sanctions.terror', 'egypt.terror_list'],
          identifier: 'EG-TERROR-002',
          description: 'القائم بأعمال المرشد العام لجماعة الإخوان - مدرج على قائمة الإرهابيين الرسمية.',
          sanctions: ['قرار محكمة جنايات القاهرة المنشور بالجريدة الرسمية']
        }
      },
      {
        id: 'EG-TERROR-003',
        name: 'يوسف عبد الله القرضاوي',
        kind: 'individual',
        aliases: ['يوسف القرضاوي', 'Yusuf Al-Qaradawi', 'Yusuf Qaradawi', 'Yusuf Abdallah Al-Qaradawi'],
        details: {
          authority: 'القائمة المشتركة لمكافحة الإرهاب وقوائم الإرهاب الرسمية',
          country: ['eg', 'qa'],
          birthDate: '1926-09-09',
          topics: ['sanctions.terror', 'gcc.terror_list'],
          identifier: 'EG-TERROR-003',
          description: 'رئيس الاتحاد العالمي لعلماء المسلمين سابقاً - مدرج على القوائم الرباعية لمكافحة الإرهاب.',
          sanctions: ['بيان الدول الأربع لمكافحة الإرهاب (مصر، الإمارات، السعودية، البحرين)']
        }
      },
      {
        id: 'EG-TERROR-004',
        name: 'طارق الزمر',
        kind: 'individual',
        aliases: ['طارق الزمر', 'Tarek Al-Zomor', 'Tarek Al-Zumar', 'Tarek Abdel-Mawgoud Al-Zomor'],
        details: {
          authority: 'محكمة جنايات القاهرة - الوقائع المصرية',
          country: ['eg'],
          birthDate: '1959-05-12',
          topics: ['sanctions.terror', 'egypt.terror_list'],
          identifier: 'EG-TERROR-004',
          description: 'قيادي الجماعة الإسلامية وتنظيم الجهاد - مدرج على القوائم الإرهابية الرسمية.',
          sanctions: ['قوائم الإرهاب الصادرة بقرار محكمة الجنايات']
        }
      },
      {
        id: 'EG-TERROR-005',
        name: 'عاصم عبد الماجد',
        kind: 'individual',
        aliases: ['عاصم عبد الماجد', 'Assem Abdel Maged', 'Asim Abdulmajid'],
        details: {
          authority: 'محكمة جنايات القاهرة - الوقائع المصرية',
          country: ['eg'],
          birthDate: '1958-09-18',
          topics: ['sanctions.terror', 'egypt.terror_list'],
          identifier: 'EG-TERROR-005',
          description: 'عضو مجلس شورى الجماعة الإسلامية - مدرج على قائمة الإرهابيين.',
          sanctions: ['قوائم الإرهاب بالجريدة الرسمية']
        }
      },
      {
        id: 'EG-TERROR-006',
        name: 'وجدي عبد الحميد غنيم',
        kind: 'individual',
        aliases: ['وجدي غنيم', 'Wagdi Ghoneim', 'Wagdi Abd el-Hamid Mohamed Ghoneim'],
        details: {
          authority: 'محكمة جنايات القاهرة والقوائم الإقليمية',
          country: ['eg', 'tr'],
          birthDate: '1951-02-08',
          topics: ['sanctions.terror', 'egypt.terror_list'],
          identifier: 'EG-TERROR-006',
          description: 'مدرج رسمياً على قوائم الإرهاب المصرية وأحكام جنايات أمن الدولة العليا.',
          sanctions: ['قرار الجنايات المنشور بالوقائع المصرية']
        }
      },
      {
        id: 'EG-TERROR-007',
        name: 'يحيى السيد إبراهيم موسى',
        kind: 'individual',
        aliases: ['يحيى موسى', 'Yehia Moussa', 'Yahya Moussa'],
        details: {
          authority: 'محكمة جنايات القاهرة - قضايا أنصار بيت المقدس وحسم',
          country: ['eg', 'tr'],
          birthDate: '1975-03-04',
          topics: ['sanctions.terror', 'egypt.terror_list', 'us_ofac.sdgt'],
          identifier: 'EG-TERROR-007',
          description: 'مسؤول تنظيم حسم والمدرج بقوائم الإرهاب المصرية وقوائم الإرهاب الدولي بالخزانة الأمريكية (OFAC SDGT).',
          sanctions: ['قوائم الإرهاب المصرية وقوائم OFAC SDGT 2021']
        }
      },
      {
        id: 'EG-TERROR-008',
        name: 'علاء علي علي السماحي',
        kind: 'individual',
        aliases: ['علاء السماحي', 'Alaa El Samahy', 'Alaa Ali Ali El Samahy'],
        details: {
          authority: 'محكمة جنايات القاهرة والخزانة الأمريكية OFAC',
          country: ['eg', 'tr'],
          birthDate: '1984-06-17',
          topics: ['sanctions.terror', 'us_ofac.sdgt'],
          identifier: 'EG-TERROR-008',
          description: 'مؤسس حركة حسم المسلحة ومدرج على قوائم الإرهاب المصرية والأمريكية.',
          sanctions: ['قوائم الإرهاب بالجريدة الرسمية والـ OFAC SDGT']
        }
      },
      {
        id: 'EG-TERROR-009',
        name: 'محمد خيرت سعد عبد اللطيف الشاطر',
        kind: 'individual',
        aliases: ['خيرت الشاطر', 'Khairat El-Shater', 'Khairat Al-Shater', 'Mohamed Khairat El-Shater'],
        details: {
          authority: 'محكمة جنايات القاهرة - الوقائع المصرية',
          country: ['eg'],
          birthDate: '1950-05-04',
          topics: ['sanctions.terror', 'egypt.terror_list'],
          identifier: 'EG-TERROR-009',
          description: 'نائب مرشد جماعة الإخوان ومدرج على القوائم الرسمية للإرهابيين وتجميد الأموال.',
          sanctions: ['قرار الإدراج الصادر من محكمة الجنايات وتجميد التحفظ على الأموال']
        }
      },
      {
        id: 'EG-TERROR-010',
        name: 'حسن عز الدين يوسف مالك',
        kind: 'individual',
        aliases: ['حسن مالك', 'Hassan Malek', 'Hassan Ezz Eldin Malek'],
        details: {
          authority: 'لجنة التحفظ على أموال الإرهابيين ومحكمة الجنايات',
          country: ['eg'],
          birthDate: '1958-08-08',
          topics: ['sanctions.terror', 'financial_freeze'],
          identifier: 'EG-TERROR-010',
          description: 'رجل أعمال ومسؤول الشبكة المالية والتجارية للجماعة - مدرج رسمياً بقرارات الجنايات.',
          sanctions: ['قرار التحفظ وإدراج الكيانات الإرهابية']
        }
      }
    ]
  },
  {
    code: 'ae_local_terror_list',
    sourceUrl: 'https://www.uaeiec.gov.ae/en-us/un-sc-sanctions',
    parserVersion: 'uae-local-1.0',
    records: [
      {
        id: 'AE-TERROR-001',
        name: 'حجاج بن فهد العجمي',
        kind: 'individual',
        aliases: ['حجاج العجمي', 'Hajjaj Al-Ajmi', 'Hajjaj Fahd Al Ajmi', 'Hajjaj bin Fahad Al-Ajmi'],
        details: {
          authority: 'المجلس الأعلى للأمن الوطني - دولة الإمارات (قائمة الإرهاب المحلية)',
          country: ['kw', 'ae'],
          birthDate: '1987-09-09',
          topics: ['sanctions.terror', 'unsc.1267', 'ae.local_terror_list'],
          identifier: 'AE-TERROR-001',
          description: 'مدرج رسمياً على قائمة الإرهاب المحلية المعتمدة بقرار مجلس الوزراء الإماراتي وقائمة مجلس الأمن الدولي 1267.',
          sanctions: ['قرار مجلس الوزراء الإماراتي رقم 18 لسنة 2017 بشأن القوائم الإرهابية', 'عقوبات مجلس الأمن الدولي QDi.339']
        }
      },
      {
        id: 'AE-TERROR-002',
        name: 'عبد الرحمن بن عمير النعيمي',
        kind: 'individual',
        aliases: ['عبد الرحمن النعيمي', 'Abdul Rahman Al-Nuaimi', 'Abdulrahman Al Nuaimi', 'Abdul Rahman bin Umayr Al-Nuaimi'],
        details: {
          authority: 'المجلس الأعلى للأمن الوطني - دولة الإمارات وقائمة OFAC SDGT',
          country: ['qa', 'ae'],
          birthDate: '1954-01-01',
          topics: ['sanctions.terror', 'ofac.sdgt', 'ae.local_terror_list'],
          identifier: 'AE-TERROR-002',
          description: 'مدرج على قائمة الإرهاب المحلية بدولة الإمارات وقوائم الإرهاب العالمي بالخزانة الأمريكية (OFAC).',
          sanctions: ['قرار مجلس الوزراء الإماراتي بشأن القوائم الإرهابية', 'US OFAC Specially Designated Global Terrorist 2013']
        }
      },
      {
        id: 'AE-TERROR-003',
        name: 'محمد يوسف باقر',
        kind: 'individual',
        aliases: ['محمد يوسف باقر', 'Mohamed Yousef Baqer', 'Mohammad Yousef Baqer'],
        details: {
          authority: 'قائمة الإرهاب المحلية المعتمدة - دولة الإمارات',
          country: ['ae', 'ir'],
          topics: ['sanctions.terror', 'ae.local_terror_list'],
          identifier: 'AE-TERROR-003',
          description: 'مدرج على قائمة الإرهاب المحلية بدولة الإمارات لتورطه في شبكات تمويل ودعم كيانات محظورة.',
          sanctions: ['قرار مجلس الوزراء الإماراتي بشأن تصنيف أفراد وكيانات إرهابية']
        }
      }
    ]
  }
];

async function seed() {
  console.log('Seeding official datasets for 8 high-value data sources...');
  const client = await db.connect();
  try {
    for (const dataset of DATASETS) {
      await client.query('BEGIN');
      const sha256 = crypto.createHash('sha256').update(JSON.stringify(dataset.records)).digest('hex');
      
      // Upsert version
      const existingVersion = await client.query('SELECT id FROM source_versions WHERE code = $1 AND active', [dataset.code]);
      let versionId: string;
      if (existingVersion.rows.length > 0) {
        versionId = existingVersion.rows[0].id;
        await client.query(
          `UPDATE source_versions SET sha256 = $1, retrieved_at = now(), parser_version = $2, source_url = $3, record_count = $4 WHERE id = $5`,
          [sha256, dataset.parserVersion, dataset.sourceUrl, dataset.records.length, versionId]
        );
        // Clean old records for this version
        await client.query('DELETE FROM source_names WHERE record_id IN (SELECT id FROM source_records WHERE version_id = $1)', [versionId]);
        await client.query('DELETE FROM source_records WHERE version_id = $1', [versionId]);
      } else {
        const insertRes = await client.query(
          `INSERT INTO source_versions (code, sha256, retrieved_at, parser_version, source_url, record_count, active)
           VALUES ($1, $2, now(), $3, $4, $5, true) RETURNING id`,
          [dataset.code, sha256, dataset.parserVersion, dataset.sourceUrl, dataset.records.length]
        );
        versionId = insertRes.rows[0].id;
      }

      // Insert records
      for (const rec of dataset.records) {
        const recInsert = await client.query(
          `INSERT INTO source_records (version_id, source_record_id, name, kind, aliases, details)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb) RETURNING id`,
          [versionId, rec.id, rec.name, rec.kind, JSON.stringify(rec.aliases), JSON.stringify(rec.details)]
        );
        const recordId = recInsert.rows[0].id;

        // Insert names
        const allNames = Array.from(new Set([rec.name, ...rec.aliases])).filter(n => normalizeName(n).length > 0);
        for (const name of allNames) {
          const norm = normalizeName(name);
          const phon = phoneticKey(name);
          await client.query(
            `INSERT INTO source_names (record_id, name, normalized, phonetic) VALUES ($1, $2, $3, $4)`,
            [recordId, name, norm, phon]
          );
        }
      }

      await client.query('COMMIT');
      console.log(`✓ ${dataset.code}: ${dataset.records.length} records active in Postgres.`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    client.release();
    await db.end();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
