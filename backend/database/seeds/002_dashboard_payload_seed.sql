INSERT INTO dashboard.data_snapshots (source_id, crisis_type, snapshot_key, captured_at, payload)
SELECT id, 'general', 'dashboard_overview', '2026-06-07T20:45:00+08:00',
  '{
    "crisisCards": [
      {"id":"covid","label":"Covid-19","type":"Health","severity":"medium","path":"/gov/pandemic","stats":[{"label":"Active cases today","value":"378","delta":"+12%"},{"label":"ICU occupancy","value":"25","delta":"+5"}],"icon":"Activity"},
      {"id":"dengue","label":"Dengue","type":"Health","severity":"high","path":"/gov/pandemic","stats":[{"label":"Red zone clusters","value":"14","delta":"+3"},{"label":"Cases this week","value":"212","delta":"+8%"}],"icon":"Activity"},
      {"id":"flood","label":"Flash Flood Risk","type":"Weather","severity":"high","path":"/gov/weather","stats":[{"label":"High-risk zones","value":"6","delta":""},{"label":"Peak rainfall (1h)","value":"45mm","delta":"Alert"}],"icon":"Cloud"},
      {"id":"panadol","label":"Panadol Shortage","type":"Supply Chain","severity":"medium","path":"/gov/supply-chain","stats":[{"label":"Affected outlets","value":"87","delta":""},{"label":"Est. restock","value":"4 days","delta":""}],"icon":"Package"},
      {"id":"cyber","label":"Cyber Incident","type":"Cybersecurity","severity":"low","path":"/gov/cybersecurity","stats":[{"label":"Active threats","value":"3","delta":"-1"}],"icon":"Shield"}
    ],
    "incidentTrend": [
      {"date":"May 13","incidents":4},{"date":"May 14","incidents":5},{"date":"May 15","incidents":7},{"date":"May 16","incidents":6},{"date":"May 17","incidents":8},{"date":"May 18","incidents":9},{"date":"May 19","incidents":8}
    ],
    "riskSummary": {
      "body":"Data projections indicate a moderate increase in respiratory cases over the next 72 hours due to deteriorating air quality. Supply disruptions for Panadol Menstrual may escalate if emergency procurement is not initiated. Recommend activating flood response protocols in eastern zones.",
      "confidence":87,
      "sources":"MOH, NEA, Enterprise SG"
    }
  }'::jsonb
FROM dashboard.data_sources WHERE code = 'signal_ui_seed'
ON CONFLICT (source_id, snapshot_key, captured_at) DO NOTHING;

INSERT INTO dashboard.data_snapshots (source_id, crisis_type, snapshot_key, captured_at, payload)
SELECT id, 'general', 'dashboard_public_home', '2026-06-07T20:45:00+08:00',
  '{
    "activeCrisisLabels":["Weather","Health","Supply"],
    "summary":"Singapore is managing flash flood risk, dengue cluster expansion, and a medicine shortage. Follow official advisories and check your area on the heatmap below.",
    "stats":[
      {"label":"Covid-19 Cases Today","value":"378","icon":"Activity","colour":"red"},
      {"label":"Air Quality (PSI)","value":"156","icon":"AlertTriangle","colour":"yellow"},
      {"label":"Essential Supply Level","value":"94%","icon":"Shield","colour":"green"},
      {"label":"Overall Situation","value":"Elevated","icon":"TrendingUp","colour":"blue"}
    ],
    "nearbyResources":[
      {"name":"Singapore General Hospital","type":"Hospital","distance":"1.2 km","status":"Available"},
      {"name":"Tanjong Pagar CC","type":"Shelter","distance":"800 m","status":"Available"},
      {"name":"Outram Park Clinic","type":"Clinic","distance":"1.5 km","status":"Available"}
    ],
    "updates":[
      {"time":"30 mins ago","message":"Flash flood advisory issued for Orchard Road and East Coast Park areas."},
      {"time":"2 hours ago","message":"Dengue red zone declared at Bedok North Ave 1. Residents advised to remove stagnant water."},
      {"time":"4 hours ago","message":"Panadol Menstrual shortage confirmed islandwide. Authorities sourcing alternatives."},
      {"time":"1 day ago","message":"Government announces enhanced flood prevention measures for 2026."}
    ]
  }'::jsonb
FROM dashboard.data_sources WHERE code = 'signal_ui_seed'
ON CONFLICT (source_id, snapshot_key, captured_at) DO NOTHING;

INSERT INTO dashboard.data_snapshots (source_id, crisis_type, snapshot_key, captured_at, payload)
SELECT id, 'cybersecurity', 'dashboard_cybersecurity', '2026-06-07T20:45:00+08:00',
  '{
    "metrics":[
      {"label":"Overall Security Status","value":"Secure","status":"ok","icon":"Shield","colour":"green"},
      {"label":"Active Threats","value":"3","status":"Active","icon":"AlertTriangle","colour":"red"},
      {"label":"Threats Blocked (24h)","value":"2.4M","status":"ok","icon":"Globe","colour":"blue"},
      {"label":"System Integrity","value":"99.97%","status":"ok","icon":"Shield","colour":"purple"}
    ],
    "threats":[
      {"type":"DDoS Attack","target":"Gov Portal","severity":"high","status":"mitigated","time":"45 mins ago"},
      {"type":"Phishing Campaign","target":"Healthcare System","severity":"medium","status":"monitoring","time":"2 hours ago"},
      {"type":"Malware Detection","target":"Public Services","severity":"low","status":"resolved","time":"5 hours ago"}
    ]
  }'::jsonb
FROM dashboard.data_sources WHERE code = 'signal_ui_seed'
ON CONFLICT (source_id, snapshot_key, captured_at) DO NOTHING;

INSERT INTO dashboard.data_snapshots (source_id, crisis_type, snapshot_key, captured_at, payload)
SELECT id, 'general', 'dashboard_recommendations', '2026-06-07T20:45:00+08:00',
  '{
    "items":[
      {"id":1,"category":"Health","agency":"MOH","action":"Activate additional ICU capacity in eastern hospitals","reasoning":"Case trend analysis shows 15-20% increase projected in next 5 days. Historical data from similar outbreaks suggests preemptive capacity expansion reduces mortality by 12-18%.","confidence":87,"urgency":"high","region":"East","sources":["MOH Case Data","Hospital Utilization Logs","Singapore 2023 Outbreak Study"],"comparison":"South Korea implemented similar measures 3 days ahead of peak, reducing overflow by 23%"},
      {"id":2,"category":"Supply Chain","agency":"Enterprise SG","action":"Initiate emergency medicine procurement from alternate suppliers","reasoning":"Current Panadol Menstrual depletion rate indicates critical shortage in 4-14 days. Diversifying import sources reduces single-point failure risk.","confidence":91,"urgency":"high","region":"Nationwide","sources":["Supply Chain Analytics","Import Dependency Map","WHO Guidelines"],"comparison":"Taiwan maintains 3-source minimum for critical medicines, reducing supply disruptions by 67%"},
      {"id":3,"category":"Weather","agency":"PUB","action":"Issue flood advisories and activate drainage reinforcement in Orchard and East Coast","reasoning":"Rainfall pattern matches historical flood events from 2018. Soil saturation at 78%, indicating high runoff risk in identified zones.","confidence":78,"urgency":"high","region":"Central, East","sources":["NEA Weather Models","PUB Drainage Data","2018 Flood Analysis"],"comparison":"Netherlands uses similar predictive models with 82% accuracy in flood prevention"},
      {"id":4,"category":"Health","agency":"NEA","action":"Deploy targeted dengue fogging operations in Bedok North and Pasir Ris","reasoning":"Two high-severity dengue clusters detected in East region with 40+ combined cases. Population density increases vector spread risk.","confidence":83,"urgency":"medium","region":"East","sources":["NEA Dengue Surveillance","MOH Case Reports","Population Density Data"],"comparison":"Malaysia reduced cluster spread by 34% with preemptive fogging within 48h of detection"},
      {"id":5,"category":"Cybersecurity","agency":"CSA","action":"Patch identified vulnerability in critical infrastructure networks","reasoning":"Active threat detected targeting port authority systems. Similar vector was exploited in 2024 regional incidents.","confidence":95,"urgency":"medium","region":"Nationwide","sources":["CSA Threat Intelligence","Interpol Cyber Advisory","Internal Network Scans"],"comparison":"Australia neutralised similar threats within 6h using coordinated patch deployment"}
    ]
  }'::jsonb
FROM dashboard.data_sources WHERE code = 'signal_ui_seed'
ON CONFLICT (source_id, snapshot_key, captured_at) DO NOTHING;

INSERT INTO dashboard.data_snapshots (source_id, crisis_type, snapshot_key, captured_at, payload)
SELECT id, 'public_sentiment', 'dashboard_sentiment', '2026-06-07T20:45:00+08:00',
  '{
    "stats":{"overallScore":59,"misinformationFlagged":47,"pendingVerification":12,"publicAnxietyLevel":"Medium"},
    "socialSources":[
      {"platform":"Twitter / X","posts":12450,"sentiment":"mixed","trending":"#Singapore #Dengue #Panadol"},
      {"platform":"Citizen Reports","posts":3287,"sentiment":"concerned","trending":"Supply, Flood, Health"},
      {"platform":"Community Forum (SiGnal)","posts":876,"sentiment":"moderate","trending":"Transport, Haze"},
      {"platform":"WhatsApp Forwarded","posts":5100,"sentiment":"anxious","trending":"Misinformation detected"}
    ],
    "misinfoQueue":[
      {"id":1,"claim":"Hospitals running out of beds","status":"flagged","priority":"high","source":"Twitter","crisisType":"health","reports":347},
      {"id":2,"claim":"Water supply contaminated in Jurong","status":"verified-false","priority":"high","source":"WhatsApp","crisisType":"health","reports":892},
      {"id":3,"claim":"Border closure imminent next week","status":"under-review","priority":"medium","source":"Forum","crisisType":"health","reports":124},
      {"id":4,"claim":"Panadol shortage is permanent","status":"flagged","priority":"medium","source":"Social Media","crisisType":"supply","reports":203}
    ],
    "summary":{"body":"Increasing public concern regarding Panadol Menstrual shortage and dengue cluster expansion. Recommend proactive communication campaign to address misinformation and clarify supply status. 47 flagged instances require human verification before public correction.","confidence":76,"sources":"Twitter, Citizen Reports, Forum"}
  }'::jsonb
FROM dashboard.data_sources WHERE code = 'signal_ui_seed'
ON CONFLICT (source_id, snapshot_key, captured_at) DO NOTHING;

INSERT INTO dashboard.data_snapshots (source_id, crisis_type, snapshot_key, captured_at, payload)
SELECT id, 'general', 'dashboard_historical', '2026-06-07T20:45:00+08:00',
  '{
    "items":[
      {"name":"2023 Dengue Outbreak","date":"June - August 2023","severity":"High","outcome":"Successfully contained","lessonsLearned":["Early cluster detection reduced spread by 34%","Community engagement programs improved compliance by 45%","Resource pre-positioning cut response time by 2.5 days"],"effectiveness":87},
      {"name":"2022 Flash Floods","date":"December 2022","severity":"Medium","outcome":"Managed with minimal disruption","lessonsLearned":["Enhanced drainage monitoring prevented overflow in 12 locations","Public transport rerouting protocols improved commute times by 18%","Real-time alerts reduced property damage by 23%"],"effectiveness":82},
      {"name":"2021 Haze Crisis","date":"September - October 2021","severity":"High","outcome":"Effectively mitigated health impacts","lessonsLearned":["N95 mask distribution to vulnerable groups reduced hospital visits by 31%","Air quality advisories via mobile apps reached 89% of population","School closure protocols minimized student exposure"],"effectiveness":79}
    ]
  }'::jsonb
FROM dashboard.data_sources WHERE code = 'signal_ui_seed'
ON CONFLICT (source_id, snapshot_key, captured_at) DO NOTHING;

INSERT INTO dashboard.map_layers (layer_key, title, payload, generated_at)
VALUES (
  'crises',
  'Seeded crisis hotspot layer',
  '{
    "markers":[
      {"id":"flood-orchard","name":"Orchard Road","latitude":1.3048,"longitude":103.8318,"value":"3 reports","detail":"Flooding reports in the last 30 minutes","severity":"critical"},
      {"id":"dengue-bedok","name":"Bedok North Ave 1","latitude":1.3321,"longitude":103.9360,"value":"23 cases","detail":"Dengue red zone under monitoring","severity":"high"},
      {"id":"supply-jurong","name":"Jurong Point","latitude":1.3397,"longitude":103.7067,"value":"4 outlets","detail":"Medicine shortage reports clustered near Jurong Point","severity":"medium"}
    ]
  }'::jsonb,
  '2026-06-07T20:45:00+08:00'
);

