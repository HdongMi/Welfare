import fetch from "node-fetch";
import fs from "fs";
import { parseStringPromise } from "xml2js";

// 1. 설정 (사용자님의 인증키)
const SERVICE_KEY = "e8e40ea23b405a5abba75382a331e61f9052570e9e95a7ca6cf5db14818ba22b";
const API_URL = "http://apis.data.go.kr/B554287/LocalWelfareServiceInquiryService/getLclWlfareLcstInq";

async function collectLocalWelfare() {
    console.log("📡 [지자체 복지 서비스] 단독 수집 시작...");

    try {
        // 안전하게 키를 인코딩하여 주소 조립 (50개 수집)
        const fullUrl = `${API_URL}?serviceKey=${encodeURIComponent(SERVICE_KEY)}&numOfRows=50&pageNo=1`;
        
        const response = await fetch(fullUrl);
        const textData = await response.text();

        // 인증 에러 체크 (키 활성화 대기 중인지 확인)
        if (textData.startsWith("Un") || textData.includes("SERVICE_KEY_IS_NOT_REGISTERED_ERROR")) {
            console.error("❌ 에러: 키가 아직 활성화되지 않았습니다. (1~24시간 소요)");
            return;
        }

        const result = await parseStringPromise(textData);
        
        // 데이터 존재 여부 확인
        if (!result.response || !result.response.body || !result.response.body[0].items[0].item) {
            console.log("⚠️ 현재 수집할 수 있는 지자체 데이터가 없습니다.");
            return;
        }

        const items = result.response.body[0].items[0].item;

        // 2. 우리 사이트(apply.html) 형식에 맞게 데이터 변환
        const processedData = items.map(item => ({
            title: item.servNm ? item.servNm[0] : "지자체 복지 서비스",
            source: item.jurMnstNm ? item.jurMnstNm[0] : "지자체",
            deadline: "상세내용 확인 요망",
            link: item.servId ? `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveWlfareInfoDetlView.do?servId=${item.servId[0]}` : "https://www.bokjiro.go.kr"
        }));

        // 3. 파일 저장
        fs.writeFileSync("welfare_data.json", JSON.stringify(processedData, null, 2));
        console.log(`✨ 성공! 지자체 복지 데이터 ${processedData.length}개를 저장했습니다.`);

    } catch (error) {
        console.error("❌ 수집 중 오류 발생:", error.message);
    }
}

collectLocalWelfare();
