import axios from "axios";
import * as cheerio from "cheerio";

// 네이버 블로그 "본문" 텍스트만 최대한 깔끔하게 뽑아주는 엔드포인트
export default async function handler(req, res) {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "url parameter required" });

    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
    const getHtml = async (u) =>
      (await axios.get(u, { headers: { "User-Agent": UA }, timeout: 15000 })).data;

    // 1) 첫 페이지 요청
    let html = await getHtml(url);
    let $ = cheerio.load(html);

    // 2) 새 에디터(ONE) 구조
    let text = $(".se-main-container").text().trim();

    // 3) 구편집기(레거시) 구조 백업
    if (!text || text.length < 50) text = $("#postViewArea").text().trim();

    // 4) 모바일(m.blog)에서 iframe 안에 원문 있을 때 재요청
    if ((!text || text.length < 50) && $("#mainFrame").attr("src")) {
      const frameSrc = $("#mainFrame").attr("src");
      const absolute = frameSrc.startsWith("http")
        ? frameSrc
        : new URL(frameSrc, "https://blog.naver.com").toString();
      const frameHtml = await getHtml(absolute);
      const _$ = cheerio.load(frameHtml);
      text = _$(".se-main-container").text().trim() || _$("#postViewArea").text().trim();
    }

    // 5) 공백 정리
    text = (text || "")
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return res.status(200).json({
      url,
      length: text.length,
      preview: text.slice(0, 300),
      content: text
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
