import fetch from "node-fetch";
import fs from "fs";
import { parseStringPromise } from "xml2js";

// 사용자님이 주신 바로 그 키입니다!
const SERVICE_KEY = "e8e40ea23b405a5abba75382a331e61f9052570e9e95a7ca6cf5db14818ba22b";

const URLS = {
    중앙부처: "http://apis.data.go.kr/B554287/NationalWelfareServiceInfoService/getNationalWelfareServiceList",
    지자체: "http://apis.data.go.kr/B554287/LocalWelfareServiceInquiryService/getLclWlfareLcstInq"
};

async function fetchData(url, type) {
    try {
        // 키를 안전하게 인코딩하여 주소에 포함합니다.
        const fullUrl = `${url}?serviceKey=${encodeURIComponent(SERVICE_KEY)}&numOfRows=50&pageNo=1`;
        
        console.log(`📡 ${type} 데이터 요청 중... URL: ${url}`);
        const response = await fetch(fullUrl);
        const textData = await response.text();

        // 서버에서 XML이 아닌 에러 메시지를 보냈는지 확인
        if (textData.startsWith("Un") || textData.includes("SERVICE_KEY_IS_NOT_REGISTERED_ERROR")) {
            console.error(`❌ ${type} 에러: 키가 아직 활성화되지 않았습니다. (보통 1~2시간 소요)`);
            return [];
        }

        const result = await parseStringPromise(textData);
        
        // 데이터 구조가 비어있는지 확인
        if (!result.response || !result.response.body || !result.response.body[0].items[0].item) {
            console.log(`⚠️ ${type}에 현재 수집할 데이터가 없습니다.`);
            return [];
        }

        const items = result.response.body[0].items[0].item;
        
        return items.map(item => ({
            title: item.servNm ? item.servNm[0] : "복지 서비스",
            source: `[${type}] ${item.jurMnstNm ? item.jurMnstNm[0] : "정부부처/지자체"}`,
            deadline: "상세내용 확인",
            link: item.servId ? `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveWlfareInfoDetlView.do?servId=${item.servId[0]}` : "https://www.bokjiro.go.kr"
        }));
    } catch (e) {
        console.error(`❌ ${type} 처리 중 오류:`, e.message);
        return [];
    }
}

async function collectAllWelfare() {
    console.log("🚀 통합 복지 수집 시작...");
    const [nationalData, localData] = await Promise.all([
        fetchData(URLS.중앙부처, "중앙부처"),
        fetchData(URLS.지자체, "지자체")
    ]);

    const combinedData = [...nationalData, ...localData];

    if (combinedData.length > 0) {
        fs.writeFileSync("welfare_data.json", JSON.stringify(combinedData, null, 2));
        console.log(`✨ 성공! 총 ${combinedData.length}개의 데이터를 저장했습니다.`);
    } else {
        console.log("⚠️ 저장할 데이터가 없습니다. 인증키 활성화를 기다려주세요.");
    }
}

collectAllWelfare();
