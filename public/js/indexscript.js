// 명언 API 호출 함수
async function fetchQuote() {
    try {
        const response = await fetch("https://korean-advice-open-api.vercel.app/api/advice");
        if (!response.ok) throw new Error("명언을 불러오는 데 실패했습니다.");

        const data = await response.json();
        const { author, authorProfile, message } = data;

        // 명언 카드 업데이트
        document.getElementById("quote-text").innerText = `"${message}"`;
        document.getElementById("quote-author").innerText = `- ${author} (${authorProfile})`;
    } catch (error) {
        console.error("명언 가져오기 오류:", error);
        document.getElementById("quote-text").innerText = "명언을 불러오는 중 오류 발생.";
        document.getElementById("quote-author").innerText = "";
    }
}

// 페이지 로드 시 명언 불러오기
document.addEventListener("DOMContentLoaded", fetchQuote);
