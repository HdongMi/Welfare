// 파일명: realtime_welfare.js
const API_KEY = 'e8e40ea23b405a5abba75382a331e61f9052570e9e95a7ca6cf5db14818ba22b';

async function getRealTimePolicies() {
    // 1. 파라미터 분리 구성 (인코딩 오류 방지)
    const baseUrl = 'https://apis.data.go.kr/1352000/getWelfareServiceList/getWelfareServiceList';
    const params = new URLSearchParams({
        serviceKey: API_KEY, // 브라우저가 자동으로 올바르게 인코딩합니다.
        callTp: 'L',
        pageNo: '1',
        numOfRows: '50'
    });

    const targetUrl = `${baseUrl}?${params.toString()}`;
    
    // 2. 500 에러를 피하기 위해 가장 우회 능력이 좋은 프록시 사용
    const proxyUrl = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=60&url=${encodeURIComponent(targetUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`서버 응답 오류: ${response.status}`);
        
        const xmlText = await response.text();
        
        // 키 문제로 인한 에러 메시지 확인
        if (xmlText.includes("SERVICE_KEY_IS_NOT_REGISTERED_ERROR") || xmlText.includes("LIMITED_NUMBER_OF_SERVICE_OK_ERROR")) {
            console.error("인증키가 등록되지 않았거나 사용량이 초과되었습니다.");
            return [];
        }

        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, "text/xml");
        const items = xml.getElementsByTagName("servList");

        if (items.length === 0) {
            console.log("수집된 데이터가 없습니다.");
            return [];
        }

        return Array.from(items).map(item => ({
            source: item.getElementsByTagName("jurMnstNm")[0]?.textContent || "중앙부처",
            title: item.getElementsByTagName("servNm")[0]?.textContent || "정책명 없음",
            link: `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52005M.do?servId=${item.getElementsByTagName("servId")[0]?.textContent}`,
            deadline: item.getElementsByTagName("bizPrdEn")[0]?.textContent || "상세참조"
        }));
    } catch (e) {
        console.error("데이터 수집 최종 에러:", e);
        return [];
    }
}
