// 파일명: realtime_welfare.js
const API_KEY = 'e8e40ea23b405a5abba75382a331e61f9052570e9e95a7ca6cf5db14818ba22b';

async function getRealTimePolicies() {
    // 1. API 주소 조립
    const baseUrl = 'https://apis.data.go.kr/1352000/getWelfareServiceList/getWelfareServiceList';
    const queryParams = `serviceKey=${API_KEY}&callTp=L&pageNo=1&numOfRows=50`;
    const targetUrl = `${baseUrl}?${queryParams}`;
    
    // 2. Github Pages 환경에서 CORS를 뚫기 위한 가장 확실한 우회 통로
    // (이 프록시는 No 'Access-Control-Allow-Origin' 에러를 강제로 해결해줍니다)
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("네트워크 응답 오류");

        const data = await response.json();
        const xmlText = data.contents; // allorigins는 실제 데이터를 contents 안에 담아줍니다.

        if (!xmlText) throw new Error("데이터를 가져오지 못했습니다.");

        // API 키 오류 체크
        if (xmlText.includes("SERVICE_KEY_IS_NOT_REGISTERED_ERROR")) {
            console.error("API 키가 아직 승인되지 않았거나 인코딩이 잘못되었습니다.");
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
        console.error("최종 에러 발생:", e);
        // 만약 여기서도 에러가 나면, 사용자에게 보여줄 '최후의 안내'
        return [];
    }
}
