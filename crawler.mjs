import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

async function run() {
    // 사용자님이 발급받은 실제 키
    const SERVICE_KEY = "e8e40ea23b405a5abba75382a331e61f9052570e9e95a7ca6cf5db14818ba22b";
    const filePath = path.join(process.cwd(), "policies.json");
    
    // 2026년 기준 최신 데이터를 가져오는 주소
    const API_URL = `https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2?serviceKey=${SERVICE_KEY}&pageNo=1&numOfRows=100&returnType=json&pblancServiceStartDate=20260101`;

    try {
        console.log(`📡 [1/2] 공공데이터 API 및 사이트 스캔 시작...`);
        
        // 1. 중기부 리스트 페이지 훑기 (상세 링크 bcIdx 확보용)
        const pageIndices = [1, 2]; 
        const pageRequests = pageIndices.map(page => 
            fetch(`https://www.mss.go.kr/site/smba/ex/bbs/List.do?cbIdx=310&pageIndex=${page}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
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
        console.log(`📡 [2/2] 상세 날짜 정밀 수집 시작 (시작일만 있는 케이스 포함)...`);

        const newPolicies = await Promise.all(itemsArray.map(async (item) => {
            const getV = (v) => (Array.isArray(v) ? v[0] : (typeof v === 'object' ? v._ : v)) || "";
            
            const title = (getV(item.pblancNm) || getV(item.title)).trim();
            if (!title || seenTitles.has(title)) return null;
            seenTitles.add(title);

            let deadline = "상세참조"; // 기본값
            
            // 매칭을 위한 제목 정제 (공백 제거 후 8글자)
            const cleanApiTitle = title.replace(/\s+/g, '').substring(0, 8);
            const match = siteData.find(sd => sd.text.includes(cleanApiTitle));
            
            let finalLink = `https://www.mss.go.kr/site/smba/ex/bbs/List.do?cbIdx=310`;

            // --- 📅 날짜 정밀 수집 로직 시작 ---
            if (match) {
                finalLink = `https://www.mss.go.kr/site/smba/ex/bbs/View.do?cbIdx=310&bcIdx=${match.id}`;
                
                try {
                    const detailRes = await fetch(finalLink, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
                    });
                    const detailHtml = await detailRes.text();
                    
                    // 태그 제거 및 공백 압축
                    const cleanText = detailHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, '');

                    // 정규식: "신청기간" 뒤에 오는 날짜와 기호를 추출
                    const dateRegex = /신청기간(\d{4}-\d{2}-\d{2}(?:\s*~\s*(?:\d{4}-\d{2}-\d{2})?)?)/;
                    const dateMatch = cleanText.match(dateRegex);

                    if (dateMatch && dateMatch[1]) {
                        deadline = dateMatch[1].trim();
                        // 끝에 ~만 남은 경우 예산 소진 시 문구 추가
                        if (deadline.endsWith('~')) deadline += " 예산 소진 시";
                        console.log(`✅ [성공] ${deadline.padEnd(25)} | ${title.substring(0, 20)}...`);
                    } else {
                        // 신청기간 텍스트 매칭 실패 시 API 데이터 활용 시도
                        const rawStart = String(getV(item.pblancStartDate) || "");
                        const rawEnd = String(getV(item.pblancEndDate) || "");
                        if (rawStart.length >= 8 && rawEnd.length >= 8) {
                            deadline = `${rawStart.substring(0,4)}-${rawStart.substring(4,6)}-${rawStart.substring(6,8)} ~ ${rawEnd.substring(0,4)}-${rawEnd.substring(4,6)}-${rawEnd.substring(6,8)}`;
                        }
                        console.log(`⚠️ [미발견] 상세페이지 내 날짜 텍스트 없음 | ${title.substring(0, 15)}`);
                    }
                } catch (e) {
                    console.log(`❌ 접속실패: ${title.substring(0, 10)}`);
                }
            }
            // --- 📅 날짜 정밀 수집 로직 끝 ---

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
