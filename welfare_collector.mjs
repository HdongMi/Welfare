// 파일명: welfare_collector.js (node welfare_collector.js 로 실행)
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

async function run() {
    // 사용자님이 주신 실제 키와 API 주소
    const SERVICE_KEY = "e8e40ea23b405a5abba75382a331e61f9052570e9e95a7ca6cf5db14818ba22b";
    
    // ⚠️ 파일명을 다르게 설정하여 기존 policies.json을 보호합니다.
    const filePath = path.join(process.cwd(), "welfare_data.json");
    
    const API_URL = `https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2?serviceKey=${SERVICE_KEY}&pageNo=1&numOfRows=100&returnType=json&pblancServiceStartDate=20260101`;

    try {
        console.log(`📡 [전용 수집기] 복지 서비스 데이터 스캔 시작...`);
        const apiRes = await fetch(API_URL);
        const apiText = await apiRes.text();

        let itemsArray = [];
        if (apiText.includes("<item>")) {
            const xmlData = await parseStringPromise(apiText);
            const items = xmlData?.response?.body?.[0]?.items?.[0]?.item;
            itemsArray = Array.isArray(items) ? items : (items ? [items] : []);
        } else {
            const jsonData = JSON.parse(apiText);
            itemsArray = jsonData.response?.body?.items || [];
        }

        const newPolicies = itemsArray.map(item => {
            const getV = (v) => (Array.isArray(v) ? v[0] : (typeof v === 'object' ? v._ : v)) || "";
            const title = (getV(item.pblancNm) || getV(item.title)).trim();
            const rawStart = String(getV(item.pblancStartDate) || "");
            const rawEnd = String(getV(item.pblancEndDate) || "");
            
            let deadline = "상세참조";
            if (rawStart.length >= 8 && rawEnd.length >= 8) {
                deadline = `${rawStart.substring(0,4)}-${rawStart.substring(4,6)}-${rawStart.substring(6,8)} ~ ${rawEnd.substring(0,4)}-${rawEnd.substring(4,6)}-${rawEnd.substring(6,8)}`;
            }

            return {
                title,
                source: getV(item.areaNm) || "중소벤처기업부",
                deadline: deadline,
                link: `https://www.mss.go.kr/site/smba/ex/bbs/List.do?cbIdx=310`
            };
        });

        // 전용 파일로 저장
        fs.writeFileSync(filePath, JSON.stringify(newPolicies, null, 2), "utf8");
        console.log(`✨ 성공! welfare_data.json 파일이 생성되었습니다.`);

    } catch (error) {
        console.error("❌ 오류 발생:", error.message);
    }
}
run();
