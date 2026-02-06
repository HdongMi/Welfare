import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

async function run() {
    // 사용자님이 발급받은 실제 키
    const SERVICE_KEY = "e8e40ea23b405a5abba75382a331e61f9052570e9e95a7ca6cf5db14818ba22b";
    const filePath = path.join(process.cwd(), "policies.json");
    
    // 2026년 기준 최신 데이터를 가져오는 주소 (pblancServiceStartDate 파라미터 유지)
    const API_URL = `https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2?serviceKey=${SERVICE_KEY}&pageNo=1&numOfRows=100&returnType=json&pblancServiceStartDate=20260101`;

    try {
        console.log(`📡 [1/2] 공공데이터 API 및 사이트 스캔 시작...`);
        
        // 1. 중기부 리스트 페이지 훑기 (상세 링크 bcIdx 확보용)
        const pageIndices = [1, 2]; 
        const pageRequests = pageIndices.map(page => 
            fetch(`https://www.mss.go.kr/site/smba/ex/bbs/List.do?cbIdx=310&pageIndex=${page}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            }).then(res => res.text())
        );
        const pagesHtml = await Promise.all(pageRequests);
        
        const siteData = [];
        pagesHtml.forEach(listHtml => {
            const rows = listHtml.match(/<tr[\s\S]*?<\/tr>/g) || [];
            rows.forEach(row => {
                const bcIdxMatch = row.match(/bcIdx=(\d+)/);
                const siteTitle = row.replace(/<[^>]*>/g, '').replace(/\s+/g, '').trim();
                if (bcIdxMatch) siteData.push({ id: bcIdxMatch[1], text: siteTitle });
            });
        });

        // 2. 실제 API 호출
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

        const seenTitles = new Set();
        console.log(`📡 [2/2] 상세 데이터 가공 중...`);

        const newPolicies = await Promise.all(itemsArray.map(async (item) => {
            const getV = (v) => (Array.isArray(v) ? v[0] : (typeof v === 'object' ? v._ : v)) || "";
            
            const title = (getV(item.pblancNm) || getV(item.title)).trim();
            if (!title || seenTitles.has(title)) return null;
            seenTitles.add(title);

            // --- 📅 날짜 처리 로직 수정 시작 ---
            // API 응답 필드명이 pblancStartDate(공고시작일)인 경우가 많으므로 교차 체크합니다.
            const rawStart = String(getV(item.pblancStartDate) || getV(item.pblancServiceStartDate) || ""); 
            const rawEnd = String(getV(item.pblancEndDate) || getV(item.pblancServiceEndDate) || "");     
            
            let deadline = "상세참조";

            // YYYYMMDD 형식을 YYYY-MM-DD로 변환하는 헬퍼 함수
            const formatDate = (dateStr) => {
                const clean = dateStr.replace(/[^0-9]/g, '');
                if (clean.length >= 8) {
                    return `${clean.substring(0,4)}-${clean.substring(4,6)}-${clean.substring(6,8)}`;
                }
                return null;
            };

            const startFormatted = formatDate(rawStart);
            const endFormatted = formatDate(rawEnd);

            if (startFormatted && endFormatted) {
                deadline = `${startFormatted} ~ ${endFormatted}`;
            } else if (startFormatted) {
                deadline = `${startFormatted} ~ 상세참조`;
            }
            // --- 📅 날짜 처리 로직 수정 끝 ---

            const cleanApiTitle = title.replace(/\s+/g, '').substring(0, 8);
            const match = siteData.find(sd => sd.text.includes(cleanApiTitle));
            
            let finalLink = `https://www.mss.go.kr/site/smba/ex/bbs/List.do?cbIdx=310`;
            if (match) {
                finalLink = `https://www.mss.go.kr/site/smba/ex/bbs/View.do?cbIdx=310&bcIdx=${match.id}`;
            }

            return {
                title,
                region: getV(item.areaNm) || "전국",
                deadline: deadline,
                source: "중소벤처기업부",
                link: finalLink
            };
        }));

        const filteredPolicies = newPolicies.filter(p => p !== null);
        
        // 최종 파일 저장
        fs.writeFileSync(filePath, JSON.stringify(filteredPolicies, null, 2), "utf8");
        console.log(`\n✨ 성공! ${filteredPolicies.length}개의 정책이 담긴 policies.json 파일이 생성되었습니다.`);

    } catch (error) {
        console.error("❌ 오류 발생:", error.message);
    }
}

run();
