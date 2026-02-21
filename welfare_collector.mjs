import fetch from "node-fetch";
import fs from "fs";
import { parseStringPromise } from "xml2js";

// 1. 설정 (발급받으신 서비스키를 여기에 꼭 넣으세요!)
const SERVICE_KEY = "e8e40ea23b405a5abba75382a331e61f9052570e9e95a7ca6cf5db14818ba22b"; 
const API_URL = "http://apis.data.go.kr/B554287/LocalWelfareServiceInquiryService/getLclWlfareLcstInq";

async function collectWelfareData() {
    console.log("📡 [지자체 복지 서비스] 데이터 수집 시작...");

    try {
        // 2. API 호출 (지자체 데이터는 보통 양이 많으므로 50개 정도 가져옵니다)
        const fullUrl = `${API_URL}?serviceKey=${SERVICE_KEY}&numOfRows=50&pageNo=1`;
        
        const response = await fetch(fullUrl);
        const xmlData = await response.text();

        // 3. XML -> JSON 변환
        const result = await parseStringPromise(xmlData);
        
        // API 구조에 따라 items 위치가 다를 수 있으니 안전하게 접근합니다.
        const items = result.response.body[0].items[0].item;

        if (!items) {
            console.log("⚠️ 현재 수집 가능한 지자체 복지 데이터가 없습니다.");
            return;
        }

        // 4. 데이터 가공 (지자체 API 항목 명칭 적용)
        const processedData = items.map(item => ({
            // servNm: 서비스명, jurMnstNm: 소관지자체이름, servDgst: 서비스요약
            title: item.servNm ? item.servNm[0] : "복지 서비스",
            source: item.jurMnstNm ? item.jurMnstNm[0] : "지자체",
            // 지자체 데이터는 '신청기간' 항목이 따로 없는 경우가 많아 요약 내용으로 대체하거나 고정문구를 넣습니다.
            deadline: "상세내용 확인 요망", 
            link: item.servId ? `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveWlfareInfoDetlView.do?servId=${item.servId[0]}` : "https://www.bokjiro.go.kr"
        }));

        // 5. 파일 저장
        fs.writeFileSync("welfare_data.json", JSON.stringify(processedData, null, 2));
        console.log(`✨ 성공! 지자체 복지 서비스 ${processedData.length}개를 welfare_data.json에 저장했습니다.`);

    } catch (error) {
        console.error("❌ 데이터 수집 중 에러 발생:", error);
    }
}

collectWelfareData();
