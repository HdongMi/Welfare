// 파일명: realtime_welfare.js
const API_KEY = 'e8e40ea23b405a5abba75382a331e61f9052570e9e95a7ca6cf5db14818ba22b';

async function getRealTimePolicies() {
    // 중앙부처 정책 API 주소
    const target = `https://apis.data.go.kr/1352000/getWelfareServiceList/getWelfareServiceList?serviceKey=${API_KEY}&callTp=L&pageNo=1&numOfRows=50`;
    
    // [중요] 기존에 막혔던 allorigins 대신 더 강력한 corsproxy.io를 사용합니다.
    const proxy = `https://corsproxy.io/?${encodeURIComponent(target)}`;

    try {
        const response = await fetch(proxy);
        
        // 응답이 정상인지 확인
        if (!response.ok) throw new Error("네트워크 응답 에러");
        
        const xmlText = await response.text();
        
        // 데이터가 비어있는지 확인
        if (!xmlText || xmlText.includes("SERVICE_KEY_IS_NOT_REGISTERED_ERROR")) {
            console.error("API 키가 등록되지 않았거나 인코딩 오류입니다.");
            return [];
        }

        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, "text/xml");
        const items = xml.getElementsByTagName("servList");

        if (items.length === 0) return [];

        return Array.from(items).map(item => ({
            source: item.getElementsByTagName("jurMnstNm")[0]?.textContent || "중앙부처",
            title: item.getElementsByTagName("servNm")[0]?.textContent || "정책명 없음",
            link: `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52005M.do?servId=${item.getElementsByTagName("servId")[0]?.textContent}`,
            deadline: item.getElementsByTagName("bizPrdEn")[0]?.textContent || "상세참조"
        }));
    } catch (e) {
        console.error("데이터 수집 에러:", e);
        return [];
    }
}
