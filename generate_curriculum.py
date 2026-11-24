import json
from datetime import date, timedelta

start_date = date(2026, 11, 30)
end_date = date(2027, 1, 31)

science_units = [
    {
        "unitNum": 1,
        "chapter": "Ⅰ. 물질과 규칙성",
        "title": "01. 우주 초기 원소의 형성",
        "summary": "빅뱅 우주론, 기본 입자의 형성, 수소와 헬륨의 원자핵 생성(질량비 3:1) 및 우주 배경 복사(2.7K) 관측",
        "keywords": ["#빅뱅우주론", "#수소와헬륨", "#우주배경복사", "#선스펙트럼"]
    },
    {
        "unitNum": 2,
        "chapter": "Ⅰ. 물질과 규칙성",
        "title": "02. 무거운 원소의 형성과 태양계 형성",
        "summary": "별의 진화와 내부 핵융합 반응(수소→헬륨→탄소→철), 초신성 폭발을 통한 철보다 무거운 원소 생성, 성운설과 지구 형성",
        "keywords": ["#별의진화", "#핵융합반응", "#초신성폭발", "#태양계성운설"]
    },
    {
        "unitNum": 3,
        "chapter": "Ⅰ. 물질과 규칙성",
        "title": "03. 원소의 주기성과 화학 결합",
        "summary": "주기율표의 구성 원리(족과 주기), 알칼리 금속과 할로젠의 성질, 원자가 전자와 옥텟 규칙",
        "keywords": ["#주기율표", "#알칼리금속", "#할로젠원소", "#옥텟규칙"]
    },
    {
        "unitNum": 4,
        "chapter": "Ⅰ. 물질과 규칙성",
        "title": "04. 화학 결합의 성질과 이용",
        "summary": "이온 결합과 공유 결합의 형성 메커니즘, 결합에 따른 물질의 물리적 성질(녹는점, 전기 전도성 등) 비교",
        "keywords": ["#이온결합", "#공유결합", "#전기전도성", "#양이온음이온"]
    },
    {
        "unitNum": 5,
        "chapter": "Ⅰ. 물질과 규칙성",
        "title": "05. 지각과 생명체 구성 물질의 결합 규칙성",
        "summary": "지각을 구성하는 규산염 광물의 사면체 결합 구조, 생명체를 구성하는 탄소 화합물(단백질, 핵산)의 결합 다양성",
        "keywords": ["#규산염사면체", "#탄소골격", "#아미노산", "#핵산과뉴클레오타이드"]
    },
    {
        "unitNum": 6,
        "chapter": "Ⅰ. 물질과 규칙성",
        "title": "06. 신소재의 개발과 활용",
        "summary": "전기적·자기적 성질을 이용한 신소재(초전도체, 반도체), 자연 모사 신소재(벨크로, 연잎 효과), 첨단 나노 소재(그래핀, 탄소 나노튜브)",
        "keywords": ["#초전도체", "#마이스너효과", "#그래핀", "#자연모사기술"]
    },
    {
        "unitNum": 7,
        "chapter": "Ⅰ. 물질과 규칙성",
        "title": "[대단원 점검 1] Ⅰ. 물질과 규칙성 핵심 기출 & 개념 그물망",
        "summary": "물질과 규칙성 대단원 총정리, 수소·헬륨 스펙트럼 및 화학결합 빈출 계산·서술형 마스터",
        "keywords": ["#대단원복습", "#기출문제풀이", "#오답클리닉", "#개념백지인출"]
    },
    {
        "unitNum": 8,
        "chapter": "Ⅱ. 시스템과 상호 작용",
        "title": "07. 중력과 역학적 시스템",
        "summary": "중력의 상호작용, 자유 낙하 운동과 수평 방향으로 던진 물체의 포물선 운동 비교 분석(등가속도, 등속도)",
        "keywords": ["#중력", "#자유낙하운동", "#수평투사", "#가속도법칙"]
    },
    {
        "unitNum": 9,
        "chapter": "Ⅱ. 시스템과 상호 작용",
        "title": "08. 운동량과 충격량",
        "summary": "운동량과 충격량의 정의와 관계(I = Δp), 충돌 시간과 충격력의 반비례 관계, 일상 속 충격 흡수 안전장치",
        "keywords": ["#운동량", "#충격량", "#충돌시간", "#에어백과안전띠"]
    },
    {
        "unitNum": 10,
        "chapter": "Ⅱ. 시스템과 상호 작용",
        "title": "09. 지구 시스템의 에너지와 물질 순환",
        "summary": "지구 시스템 5대 권역(기권, 수권, 지권, 생물권, 외권)의 상호작용, 태양/지구내부/조석 에너지 흐름, 탄소·물 순환",
        "keywords": ["#지구시스템", "#상호작용", "#탄소순환", "#에너지수지"]
    },
    {
        "unitNum": 11,
        "chapter": "Ⅱ. 시스템과 상호 작용",
        "title": "10. 지권의 변화와 판 구조론",
        "summary": "판 구조론의 정립과 판의 경계(수렴형, 발산형, 보존형), 경계별 화산·지진 활동과 지형(해구, 해령, 변환단층)",
        "keywords": ["#판구조론", "#수렴형경계", "#발산형경계", "#변환단층과해령"]
    },
    {
        "unitNum": 12,
        "chapter": "Ⅱ. 시스템과 상호 작용",
        "title": "11. 생명 시스템의 기본 단위와 세포막",
        "summary": "세포의 구조와 소기관별 기능(핵, 미토콘드리아, 엽록체, 리보솜), 인지질 2중층 구조와 세포막의 물질 이동(확산, 삼투)",
        "keywords": ["#세포소기관", "#인지질2중층", "#선택적투과성", "#삼투와확산"]
    },
    {
        "unitNum": 13,
        "chapter": "Ⅱ. 시스템과 상호 작용",
        "title": "12. 세포 내 정보의 흐름과 유전 암호",
        "summary": "생명 중심 원리(Central Dogma), DNA의 삼중수소 전사와 mRNA 번역, 코돈 암호 체계와 단백질 합성",
        "keywords": ["#생명중심원리", "#전사와번역", "#코돈", "#단백질합성"]
    },
    {
        "unitNum": 14,
        "chapter": "Ⅱ. 시스템과 상호 작용",
        "title": "13. 생명 활동과 효소",
        "summary": "물질대사(동화 작용, 이화 작용)의 특성, 생체 촉매 효소의 활성화 에너지 감소 원리와 기질 특이성",
        "keywords": ["#동화작용", "#이화작용", "#생체촉매", "#활성화에너지"]
    },
    {
        "unitNum": 15,
        "chapter": "Ⅱ. 시스템과 상호 작용",
        "title": "[대단원 점검 2] Ⅱ. 시스템과 상호 작용 핵심 기출 & 공식 정리",
        "summary": "역학적 시스템 충격량 계산, 판 경계 지형 암기, 유전 정보 전사/번역 킬러 유형 정복",
        "keywords": ["#대단원복습", "#역학공식정리", "#코돈암호해독", "#기출오답"]
    },
    {
        "unitNum": 16,
        "chapter": "Ⅲ. 변화와 다양성",
        "title": "14. 산화 환원 반응과 일상생활",
        "summary": "산소의 이동 및 전자의 이동에 의한 산화 환원 반응 정의, 광합성·호흡·연소·철의 부식 등 일상생활 속 산화 환원",
        "keywords": ["#산화환원", "#전자의이동", "#광합성과호흡", "#철의부식방지"]
    },
    {
        "unitNum": 17,
        "chapter": "Ⅲ. 변화와 다양성",
        "title": "15. 산과 염기, 중화 반응",
        "summary": "산과 염기의 성질과 공통 이온, 중화 반응의 메커니즘, 혼합 용액의 온도 변화 및 지시약 색 변화, 이온 수 양적 관계",
        "keywords": ["#산과염기", "#중화반응", "#양적관계", "#지시약색변화"]
    },
    {
        "unitNum": 18,
        "chapter": "Ⅲ. 변화와 다양성",
        "title": "16. 지질 시대의 환경과 생물 변천",
        "summary": "화석과 지층의 형성, 지질 시대 구분(선캄브리아대, 고생대, 중생대, 신생대)과 대표 표준화석·시상화석, 대멸종의 원인",
        "keywords": ["#지질시대", "#표준화석", "#시상화석", "#대멸종과생물다양성"]
    },
    {
        "unitNum": 19,
        "chapter": "Ⅲ. 변화와 다양성",
        "title": "17. 자연 선택과 생물의 진화",
        "summary": "개체 변이와 환경 적응, 다윈의 자연 선택설에 따른 종 분화 과정, 항생제 내성 세균 및 겸형 적혈구 빈혈증 사례",
        "keywords": ["#자연선택설", "#개체변이", "#항생제내성", "#생물진화"]
    },
    {
        "unitNum": 20,
        "chapter": "Ⅲ. 변화와 다양성",
        "title": "[대단원 점검 3] Ⅲ. 변화와 다양성 핵심 기출 & 중화 반응 특강",
        "summary": "중화 반응 양적 관계 이온 수 그래프 해석, 지질 시대 순서 암기, 자연 선택 서술형 완성",
        "keywords": ["#대단원복습", "#중화반응계산", "#지질시대암기", "#자연선택"]
    },
    {
        "unitNum": 21,
        "chapter": "심화 마스터",
        "title": "[통합과학 심화 1] Ⅰ~Ⅲ단원 빈출 킬러 유형(역학·유전) 마스터 1편",
        "summary": "수평 투사 운동 역학 계산, DNA-RNA 코돈 유전 암호 추론 문제 집중 공략",
        "keywords": ["#킬러문항", "#역학추론", "#코돈암호", "#상위1등급"]
    },
    {
        "unitNum": 22,
        "chapter": "심화 마스터",
        "title": "[통합과학 심화 2] Ⅰ~Ⅲ단원 빈출 킬러 유형(판구조·산화환원) 마스터 2편",
        "summary": "판 경계 단면도 지형 분석, 복합 산화 환원 반응식 완성과 전자 수 이동 파악",
        "keywords": ["#킬러문항", "#판경계단면도", "#산화환원식", "#실전대비"]
    },
    {
        "unitNum": 23,
        "chapter": "실전 모의평가",
        "title": "[통합과학 실전 1] 1학기 전범위 중간·기말 실전 모의평가 1회",
        "summary": "45분 시간 안배 실전 모의고사 25문항 풀이, 약점 영역 실시간 인출 체크",
        "keywords": ["#실전모의고사", "#시간관리", "#약점체크", "#1학기전범위"]
    },
    {
        "unitNum": 24,
        "chapter": "실전 모의평가",
        "title": "[통합과학 실전 2] 1학기 전범위 중간·기말 실전 모의평가 2회 & 오답 정리",
        "summary": "실전 모의평가 2회 및 오답 메타인지 정리, 취약 문항 개념 그물망 최종 보완",
        "keywords": ["#최종모의평가", "#오답노트", "#메타인지인출", "#완벽대비"]
    }
]

history_units = [
    {
        "unitNum": 1,
        "chapter": "Ⅰ. 근대 이전 한국사의 이해",
        "title": "01. 고대 국가의 지배 체제와 사회",
        "summary": "고조선의 성립, 삼국의 영토 확장과 통치 체제, 가야 연맹, 신라의 삼국 통일과 통일신라·발해의 남북국 시대 발전",
        "keywords": ["#삼국항쟁", "#남북국시대", "#통일신라", "#발해해동성국", "#골품제"]
    },
    {
        "unitNum": 2,
        "chapter": "Ⅰ. 근대 이전 한국사의 이해",
        "title": "02. 고려의 통치 체제와 국제 질서의 변동",
        "summary": "태조 왕건의 후삼국 통일과 정책, 고려의 2성 6부 통치 기구, 문벌 사회 동요와 무신 정변, 거란·여진·몽골 대외 항쟁",
        "keywords": ["#고려건국", "#2성6부", "#무신정변", "#대몽항쟁", "#공민왕개혁"]
    },
    {
        "unitNum": 3,
        "chapter": "Ⅰ. 근대 이전 한국사의 이해",
        "title": "03. 조선 초기의 정치 운영과 대외 관계",
        "summary": "조선 건국과 한양 천도, 의정부 서사제와 6조 직계제, 사림 세력의 성장과 4대 사화, 4군 6진 개척 및 사대교린 외교",
        "keywords": ["#조선건국", "#유교정치", "#사림과사화", "#사대교린", "#경국대전"]
    },
    {
        "unitNum": 4,
        "chapter": "Ⅰ. 근대 이전 한국사의 이해",
        "title": "04. 양반 신분제 사회와 민족 문화의 발달",
        "summary": "양천제와 양반 관료 중심 신분제, 훈민정음 창제와 서적 편찬, 측우기·혼천의 등 조선 전기 과학 기술 발달",
        "keywords": ["#양반신분제", "#훈민정음", "#조선전기과학", "#유교문화"]
    },
    {
        "unitNum": 5,
        "chapter": "Ⅰ. 근대 이전 한국사의 이해",
        "title": "05. 조선 후기 통치 체제의 개편과 정치 변동",
        "summary": "임진왜란·병자호란 이후 비변사의 최고 기구화, 5군영 체제, 대동법·영정법·균역법 실시, 붕당 정치의 전개와 탕평책",
        "keywords": ["#비변사", "#대동법", "#균역법", "#붕당정치", "#탕평책"]
    },
    {
        "unitNum": 6,
        "chapter": "Ⅰ. 근대 이전 한국사의 이해",
        "title": "06. 조선 후기 사회·경제적 변동과 새로운 사상",
        "summary": "모내기법 보급과 광작, 상품 화폐 경제 발달, 신분제 해체와 양반 매매, 중농·중상 실학사상, 서민 문화와 동학·서학 확산",
        "keywords": ["#모내기법", "#신분제동요", "#실학사상", "#서민문화", "#동학창시"]
    },
    {
        "unitNum": 7,
        "chapter": "Ⅱ. 근대 국민 국가 수립 운동",
        "title": "07. 흥선 대원군의 정책과 개항",
        "summary": "흥선 대원군의 왕권 강화책(경복궁 중건, 서원 철폐)과 통상 수교 거부 정책(병인·신미양요), 강화도 조약(1876) 체결",
        "keywords": ["#흥선대원군", "#서원철폐", "#척화비", "#강화도조약", "#개항"]
    },
    {
        "unitNum": 8,
        "chapter": "Ⅱ. 근대 국민 국가 수립 운동",
        "title": "08. 개화 정책의 추진과 반발",
        "summary": "통리기무아문 설치와 별기군 창설, 위정척사 운동 전개, 임오군란(1882)과 급진개화파의 갑신정변(1884) 14개조 개혁 정강",
        "keywords": ["#통리기무아문", "#위정척사", "#임오군란", "#갑신정변", "#개혁정강"]
    },
    {
        "unitNum": 9,
        "chapter": "Ⅱ. 근대 국민 국가 수립 운동",
        "title": "09. 동학 농민 운동과 갑오·을미개혁",
        "summary": "동학 농민 운동(고부 봉기, 전주 화약, 우금치 전투), 청일 전쟁 발발, 군국기무처 중심 1·2차 갑오개혁 및 을미개혁(단발령)",
        "keywords": ["#동학농민운동", "#집강소", "#갑오개혁", "#신분제폐지", "#을미사변"]
    },
    {
        "unitNum": 10,
        "chapter": "Ⅱ. 근대 국민 국가 수립 운동",
        "title": "10. 독립 협회와 대한 제국",
        "summary": "아관파천 이후 독립 협회의 만민공동회와 헌의 6조, 고종의 환궁과 대한 제국 선포(1897), 광무개혁(구본신참), 간도와 독도",
        "keywords": ["#독립협회", "#만민공동회", "#대한제국", "#광무개혁", "#독도칙령41호"]
    },
    {
        "unitNum": 11,
        "chapter": "Ⅲ. 일제 식민지 지배와 민족 운동",
        "title": "11. 일제의 식민지 지배 정책 변천",
        "summary": "1910년대 무단 통치(헌병 경찰제, 토지 조사 사업), 1920년대 문화 통치(치안 유지법, 산미 증식 계획), 1930~40년대 민족 말살 통치",
        "keywords": ["#토지조사사업", "#문화통치", "#산미증식계획", "#민족말살통치", "#병참기지화"]
    },
    {
        "unitNum": 12,
        "chapter": "Ⅲ. 일제 식민지 지배와 민족 운동",
        "title": "12. 3·1 운동과 대한민국 임시 정부",
        "summary": "3·1 운동의 전개 과정과 민족사적·세계사적 의의, 대한민국 임시 정부의 수립(상하이)과 연통제·교통국 활동, 구미위원부",
        "keywords": ["#31운동", "#임시정부수립", "#연통제", "#김구와한인애국단"]
    },
    {
        "unitNum": 13,
        "chapter": "Ⅲ. 일제 식민지 지배와 민족 운동",
        "title": "13. 1920년대 국내 민족 운동",
        "summary": "물산 장려 운동, 민립 대학 설립 운동, 소작 쟁의와 노동 쟁의, 6·10 만세 운동과 광주 학생 항일 운동, 민족 유일당 신간회(1927)",
        "keywords": ["#물산장려운동", "#민립대학", "#광주학생항일운동", "#신간회"]
    },
    {
        "unitNum": 14,
        "chapter": "Ⅲ. 일제 식민지 지배와 민족 운동",
        "title": "14. 1920년대 국외 독립군 전쟁과 무장 투쟁",
        "summary": "홍범도의 봉오동 전투, 김좌진의 청산리 대첩 승리, 간도 참변과 자유시 참변, 3부 성립(참의부·정의부·신민부)과 한중 연합 작전",
        "keywords": ["#봉오동전투", "#청산리대첩", "#간도참변", "#3부성립", "#한중연합작전"]
    },
    {
        "unitNum": 15,
        "chapter": "Ⅲ. 일제 식민지 지배와 민족 운동",
        "title": "15. 1930~40년대 민족 말살 정책과 항일 무장 투쟁",
        "summary": "창씨개명·황국신민화·징용과 위안부 수탈, 한국독립군과 조선혁명군 활동, 한국광복군 창설(1940)과 국내 진공 작전 준비, 광복",
        "keywords": ["#황국신민화", "#한국광복군", "#국내진공작전", "#조선건국동맹", "#815광복"]
    },
    {
        "unitNum": 16,
        "chapter": "총정리 및 사료 분석",
        "title": "[한국사 1 총정리] 근현대사 핵심 연표 백지 인출 & 빈출 사료 정리",
        "summary": "흥선대원군부터 광복까지 근현대사 핵심 사건 연표 백지 인출 테스트 및 시험 빈출 사료 총점검",
        "keywords": ["#근현대사연표", "#빈출사료", "#백지인출", "#한국사완벽정리"]
    }
]

society_units = [
    {
        "unitNum": 1,
        "chapter": "Ⅰ. 통합적 관점",
        "title": "01. 인간, 사회, 환경을 바라보는 통합적 관점",
        "summary": "시간적 관점(역사적 배경), 공간적 관점(지리적 분포), 사회적 관점(제도와 구조), 윤리적 관점(도덕적 가치)의 특성",
        "keywords": ["#시간적관점", "#공간적관점", "#사회적관점", "#윤리적관점", "#통합적시각"]
    },
    {
        "unitNum": 2,
        "chapter": "Ⅰ. 통합적 관점",
        "title": "02. 통합적 관점의 적용과 실천",
        "summary": "고령화, 기후 변화, 인공지능 등 복합적인 현대 사회 문제를 4가지 관점을 통합하여 다각도로 분석하고 대안 탐색하기",
        "keywords": ["#사회문제분석", "#융합적사고", "#고령화문제", "#통합적해결방안"]
    },
    {
        "unitNum": 3,
        "chapter": "Ⅱ. 행복",
        "title": "03. 삶의 목적으로서의 행복과 조건",
        "summary": "시대와 지역에 따라 달라지는 행복의 기준, 물질적 조건과 정신적 가치의 조화, 아리스토텔레스의 최고선으로서의 행복",
        "keywords": ["#행복의기준", "#물질과정신", "#삶의목적", "#아리스토텔레스"]
    },
    {
        "unitNum": 4,
        "chapter": "Ⅱ. 행복",
        "title": "04. 행복한 삶을 실현하기 위한 제도와 노력",
        "summary": "행복을 보장하기 위한 질 높은 정주 환경, 민주주의 제도 발전, 실질적 복지 정책, 개개인의 도덕적 성찰과 시민 참여",
        "keywords": ["#정주환경", "#민주주의", "#복지제도", "#도덕적성찰", "#시민참여"]
    },
    {
        "unitNum": 5,
        "chapter": "Ⅲ. 자연환경",
        "title": "05. 자연환경과 인간 생활의 상호 작용",
        "summary": "열대·건조·온대·냉대·한대 기후 및 평야·산지·해안 지형이 인간의 의식주, 가옥 구조, 농업 방식에 미치는 영향",
        "keywords": ["#기후대별의식주", "#가옥구조", "#지형과생활", "#자연과인간"]
    },
    {
        "unitNum": 6,
        "chapter": "Ⅲ. 자연환경",
        "title": "06. 자연에 대한 인간의 다양한 관점",
        "summary": "인간 중심주의(자연의 도구적 가치, 베이컨·데카르트)와 생태 중심주의(자연의 내재적 가치, 레오폴드 대지의 윤리) 비교",
        "keywords": ["#인간중심주의", "#생태중심주의", "#대지의윤리", "#환경윤리"]
    },
    {
        "unitNum": 7,
        "chapter": "Ⅲ. 자연환경",
        "title": "07. 환경 위기와 지속 가능한 발전",
        "summary": "지구 온난화, 사막화, 미세먼지 등 전 지구적 환경 문제의 원인, 환경 위기 극복을 위한 국제 협력과 생태 감수성 실천",
        "keywords": ["#지구온난화", "#사막화", "#지속가능발전", "#탄소중립", "#생태감수성"]
    },
    {
        "unitNum": 8,
        "chapter": "Ⅳ. 문화와 다양성",
        "title": "08. 문화의 다양성과 상대주의적 태도",
        "summary": "문화의 다양성이 나타나는 배경, 문화 상대주의의 올바른 의미와 극단적 문화 상대주의 비판, 보편 윤리의 기준",
        "keywords": ["#문화다양성", "#문화상대주의", "#자문화중심주의", "#문화사대주의", "#보편윤리"]
    },
    {
        "unitNum": 9,
        "chapter": "Ⅳ. 문화와 다양성",
        "title": "09. 문화 변동과 전통문화의 창조적 계승",
        "summary": "발명·발견 및 직접·간접 전파, 문화 동화·병존·융합 등 문화 접변의 양상, 전통문화의 고유성 보존과 창조적 계승",
        "keywords": ["#문화변동", "#문화전파", "#문화융합", "#전통문화창조적계승"]
    },
    {
        "unitNum": 10,
        "chapter": "Ⅳ. 문화와 다양성",
        "title": "10. 다문화 사회와 문화 다양성 존중",
        "summary": "한국 사회의 다문화 현황, 다문화 수용 정책 모델(용광로 이론 vs 샐러드 볼 이론), 차별 철폐와 문화적 다양성 공존",
        "keywords": ["#다문화사회", "#용광로이론", "#샐러드볼이론", "#문화공존", "#사회통합"]
    },
    {
        "unitNum": 11,
        "chapter": "Ⅳ. 문화와 다양성",
        "title": "11. 문화적 차이에 따른 갈등과 해결 방안",
        "summary": "문화적 차이로 인한 세대·지역·종교 간 갈등 사례 분석, 소통과 대화의 문화 형성, 법과 제도적 지원책",
        "keywords": ["#문화갈등", "#소통과공감", "#다문화갈등해결", "#인권존중"]
    },
    {
        "unitNum": 12,
        "chapter": "Ⅴ. 생활 공간과 사회",
        "title": "12. 산업화·도시화에 따른 생활 공간의 변화",
        "summary": "도시화율 상승과 대도시권 형성, 도시 내부 기능 분화(도심, 부도심, 주거지), 주택·교통·환경 등 도시 문제와 도시 재생",
        "keywords": ["#산업화도시화", "#도시내부구조", "#도심공동화", "#도시문제", "#도시재생"]
    },
    {
        "unitNum": 13,
        "chapter": "Ⅴ. 생활 공간과 사회",
        "title": "13. 교통·통신의 발달과 정보화에 따른 변화",
        "summary": "교통망 확충에 따른 시공간의 수축과 일일 생활권, 정보화 사회의 이점과 역기능(개인정보 유출, 디지털 디바이드, 가짜뉴스)",
        "keywords": ["#시공간수축", "#일일생활권", "#정보화사회", "#디지털디바이드", "#미디어리터러시"]
    },
    {
        "unitNum": 14,
        "chapter": "Ⅴ. 생활 공간과 사회",
        "title": "14. 지역의 공간적 변화와 지속 가능한 생활 공간",
        "summary": "세계화에 대응하는 지역화 전략(지리적 표시제, 장소 마케팅), 생태 도시와 보행자 중심 도시, 지속 가능한 거주 공간 조성",
        "keywords": ["#지역화전략", "#지리적표시제", "#장소마케팅", "#생태도시", "#지속가능생활"]
    },
    {
        "unitNum": 15,
        "chapter": "단원 총정리",
        "title": "[통합사회 1 총정리 1] Ⅰ~Ⅲ단원(관점·행복·자연) 핵심 개념 백지 인출",
        "summary": "4가지 관점 구분, 행복 조건, 인간중심 vs 생태중심주의 환경윤리 비교 총정리 및 서술형 클리닉",
        "keywords": ["#개념백지인출", "#통합적관점", "#행복과자연", "#서술형대비"]
    },
    {
        "unitNum": 16,
        "chapter": "단원 총정리",
        "title": "[통합사회 1 총정리 2] Ⅳ~Ⅴ단원(문화·공간) 수능/내신 빈출 함정 선지 정복",
        "summary": "문화 접변(동화/병존/융합) 유형 완벽 식별, 도시 내부 구조 선지 분석 및 1학기 최종 모의테스트",
        "keywords": ["#함정선지분석", "#문화접변식별", "#도시내부구조", "#통합사회1등급"]
    }
]

week9_clinic = [
    {
        "date": "2027-01-25",
        "weekday": "월",
        "subject": "한국사1",
        "unit": "[메타인지 클리닉] 한국사 1 취약 단원(🔴/🟡) 핀셋 복습 & 백지 연표 테스트",
        "chapter": "취약 단원 총복습",
        "summary": "지난 8주간 🔴(헷갈림) 또는 🟡(문제 더풀기) 표시된 한국사 단원을 모아 집중 복습하고, 근현대사 전체 연표를 백지에 인출해 봅니다.",
        "keywords": ["#메타인지클리닉", "#한국사취약보완", "#백지인출", "#연표정복"]
    },
    {
        "date": "2027-01-26",
        "weekday": "화",
        "subject": "통합과학1",
        "unit": "[메타인지 클리닉] 통합과학 1 (물질과 규칙성) 개념 빈틈 메우기 & 오답 다시 풀기",
        "chapter": "취약 단원 총복습",
        "summary": "1단원(물질과 규칙성)의 주기율표, 화학 결합, 지각·생명체 결합 규칙성에서 틀렸던 완자 문제 및 오답 선지를 완벽하게 재점검합니다.",
        "keywords": ["#메타인지클리닉", "#물질과규칙성", "#화학결합오답", "#완자클리닉"]
    },
    {
        "date": "2027-01-27",
        "weekday": "수",
        "subject": "통합사회1",
        "unit": "[메타인지 클리닉] 통합사회 1 (관점·행복·자연) 오답 클리닉 & 핵심 선지 점검",
        "chapter": "취약 단원 총복습",
        "summary": "통합사회 1~3단원의 인간·생태 중심주의 환경윤리와 행복의 조건 단원 핵심 기출 선지의 참/거짓을 정밀 판별합니다.",
        "keywords": ["#메타인지클리닉", "#환경윤리", "#행복조건", "#선지판별"]
    },
    {
        "date": "2027-01-28",
        "weekday": "목",
        "subject": "통합과학1",
        "unit": "[메타인지 클리닉] 통합과학 1 (시스템과 상호작용) 역학·세포 계산 집중 훈련",
        "chapter": "취약 단원 총복습",
        "summary": "중력·운동량·충격량 공식 적용 문제와 세포막 삼투 현상, 코돈 암호 해독 고난도 문항을 집중적으로 다시 풀어봅니다.",
        "keywords": ["#메타인지클리닉", "#역학계산", "#충격량공식", "#코돈추론"]
    },
    {
        "date": "2027-01-29",
        "weekday": "금",
        "subject": "통합사회1",
        "unit": "[메타인지 클리닉] 통합사회 1 (문화·생활공간) 핵심 개념 키워드 암기 체크",
        "chapter": "취약 단원 총복습",
        "summary": "문화 접변(융합/병존/동화), 다문화 모델, 도시 내부 구조(도심/부도심) 등 암기 키워드를 총정리하고 실전 감각을 완성합니다.",
        "keywords": ["#메타인지클리닉", "#문화접변", "#도시구조", "#최종암기"]
    },
    {
        "date": "2027-01-30",
        "weekday": "토",
        "subject": "통합과학1",
        "unit": "[메타인지 클리닉] 통합과학 1 (변화와 다양성) 산화환원·중화반응·진화 최종 마스터",
        "chapter": "취약 단원 총복습",
        "summary": "산화 환원과 중화 반응의 최고난도 킬러 유형과 지질시대 표준화석 암기를 최종 마무리하여 1학기 과학 전범위를 완성합니다.",
        "keywords": ["#메타인지클리닉", "#중화반응킬러", "#지질시대완성", "#통합과학1회독완주"]
    },
    {
        "date": "2027-01-31",
        "weekday": "일",
        "subject": "피날레",
        "unit": "[63일 완주 피날레] 63일 대장정 완주 기념 리포트 발행 & 가족 칭찬 파티!",
        "chapter": "완주 피날레",
        "summary": "63일간의 놀라운 여정을 끝까지 완주했습니다! 46개 전 단원 1회독 완주 리포트를 생성하고 엄마, 아빠와 함께 축하 파티를 즐겨요 🎉",
        "keywords": ["#63일완주성공", "#자기효능감", "#고교첫시험1등급", "#가족파티"]
    }
]

# Generate day-by-day mapping
all_tasks = []
science_idx = 0
history_idx = 0
society_idx = 0

taskId = 1

for day_idx in range(63):
    cur_date = start_date + timedelta(days=day_idx)
    date_str = cur_date.strftime("%Y-%m-%d")
    weekday_idx = cur_date.weekday() # 0: Mon, 1: Tue, 2: Wed, 3: Thu, 4: Fri, 5: Sat, 6: Sun
    weekday_kr = ["월", "화", "수", "목", "금", "토", "일"][weekday_idx]
    week_num = (day_idx // 7) + 1
    day_num = day_idx + 1

    # Check if Week 9 (Review Week)
    if week_num == 9:
        clinic_item = week9_clinic[weekday_idx]
        all_tasks.append({
            "id": f"task_{taskId}",
            "day": day_num,
            "week": week_num,
            "date": date_str,
            "weekday": weekday_kr,
            "subject": clinic_item["subject"],
            "chapter": clinic_item["chapter"],
            "unit": clinic_item["unit"],
            "summary": clinic_item["summary"],
            "keywords": clinic_item["keywords"],
            "isClinic": True,
            "isAcademy": False,
            "status": "planned",
            "plannedDate": date_str,
            "completedDate": None,
            "understanding": None,
            "daughterMemo": "",
            "cheers": []
        })
        taskId += 1
    else:
        # Weeks 1 ~ 8 Curriculum
        # 1. Tue(1), Fri(4), Sat(5) -> Science
        if weekday_idx in [1, 4, 5]:
            if science_idx < len(science_units):
                sc = science_units[science_idx]
                all_tasks.append({
                    "id": f"task_{taskId}",
                    "day": day_num,
                    "week": week_num,
                    "date": date_str,
                    "weekday": weekday_kr,
                    "subject": "통합과학1",
                    "chapter": sc["chapter"],
                    "unit": sc["title"],
                    "summary": sc["summary"],
                    "keywords": sc["keywords"],
                    "isClinic": False,
                    "isAcademy": False,
                    "status": "planned",
                    "plannedDate": date_str,
                    "completedDate": None,
                    "understanding": None,
                    "daughterMemo": "",
                    "cheers": []
                })
                taskId += 1
                science_idx += 1

        # 2. Mon(0), Wed(2) -> History
        elif weekday_idx in [0, 2]:
            if history_idx < len(history_units):
                hi = history_units[history_idx]
                all_tasks.append({
                    "id": f"task_{taskId}",
                    "day": day_num,
                    "week": week_num,
                    "date": date_str,
                    "weekday": weekday_kr,
                    "subject": "한국사1",
                    "chapter": hi["chapter"],
                    "unit": hi["title"],
                    "summary": hi["summary"],
                    "keywords": hi["keywords"],
                    "isClinic": False,
                    "isAcademy": False,
                    "status": "planned",
                    "plannedDate": date_str,
                    "completedDate": None,
                    "understanding": None,
                    "daughterMemo": "",
                    "cheers": []
                })
                taskId += 1
                history_idx += 1

        # 3. Thu(3), Sun(6) -> Society
        elif weekday_idx in [3, 6]:
            if society_idx < len(society_units):
                so = society_units[society_idx]
                all_tasks.append({
                    "id": f"task_{taskId}",
                    "day": day_num,
                    "week": week_num,
                    "date": date_str,
                    "weekday": weekday_kr,
                    "subject": "통합사회1",
                    "chapter": so["chapter"],
                    "unit": so["title"],
                    "summary": so["summary"],
                    "keywords": so["keywords"],
                    "isClinic": False,
                    "isAcademy": False,
                    "status": "planned",
                    "plannedDate": date_str,
                    "completedDate": None,
                    "understanding": None,
                    "daughterMemo": "",
                    "cheers": []
                })
                taskId += 1
                society_idx += 1

    # Academy tasks:
    # Mon, Wed: English Academy
    if weekday_idx in [0, 2]:
        all_tasks.append({
            "id": f"acad_{taskId}",
            "day": day_num,
            "week": week_num,
            "date": date_str,
            "weekday": weekday_kr,
            "subject": "영어학원",
            "chapter": "학원 진도 & 과제",
            "unit": "영어 학원 수업 & 과제 점검",
            "summary": "학원에서 배운 구문/독해/단어 진도와 오늘 완수한 숙제 내용을 기록하세요.",
            "keywords": ["#영어학원", "#어휘단어장", "#구문독해", "#숙제완료"],
            "isClinic": False,
            "isAcademy": True,
            "academyType": "english",
            "academyProgress": "",
            "homeworkDone": False,
            "status": "planned",
            "plannedDate": date_str,
            "completedDate": None,
            "understanding": None,
            "daughterMemo": "",
            "cheers": []
        })
        taskId += 1

    # Thu, Sat, Sun: Math Academy
    if weekday_idx in [3, 5, 6]:
        all_tasks.append({
            "id": f"acad_{taskId}",
            "day": day_num,
            "week": week_num,
            "date": date_str,
            "weekday": weekday_kr,
            "subject": "수학학원",
            "chapter": "학원 진도 & 과제",
            "unit": "수학 학원 수업 & 과제 점검",
            "summary": "학원 진도(공통수학1 개념/유형)와 과제 오답 피드백을 기록하세요.",
            "keywords": ["#수학학원", "#공통수학1", "#유형정복", "#오답피드백"],
            "isClinic": False,
            "isAcademy": True,
            "academyType": "math",
            "academyProgress": "",
            "homeworkDone": False,
            "status": "planned",
            "plannedDate": date_str,
            "completedDate": None,
            "understanding": None,
            "daughterMemo": "",
            "cheers": []
        })
        taskId += 1

print(f"Total tasks generated: {len(all_tasks)}")
print(f"Science used: {science_idx}/{len(science_units)}")
print(f"History used: {history_idx}/{len(history_units)}")
print(f"Society used: {society_idx}/{len(society_units)}")

# Save to curriculum.json
with open("curriculum.json", "w", encoding="utf-8") as f:
    json.dump(all_tasks, f, ensure_ascii=False, indent=2)

print("Saved curriculum.json successfully!")
