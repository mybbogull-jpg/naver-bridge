import axios from "axios";
import * as cheerio from "cheerio";

// 네이버 블로그 "댓글" 추출(가능한 경우). 비공개/더보기/별도호출이면 빈 리스트 반환.
export default async function handler(req, res) {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "url parameter required" });

    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
    const { data: html } = await axios.get(url, {
      headers: { "User-Agent": UA },
      timeout: 15000
    });

    let $ = cheerio.load(html);
    let comments = [];

    // 1) 모바일 공용댓글(u_cbox) 구조 시도
    $(".u_cbox_list .u_cbox_comment").each((_, el) => {
      const nick = $(el).find(".u_cbox_nick").text().trim();
      const txt = $(el).find(".u_cbox_contents").text().trim();
      if (txt) comments.push({ nick, text: txt });
    });

    // 2) iframe 내부일 수 있어 한 번 더 시도
    if (comments.length === 0 && $("#mainFrame").attr("src")) {
      const frameSrc = $("#mainFrame").attr("src");
      const absolute = frameSrc.startsWith("http")
        ? frameSrc
        : new URL(frameSrc, "https://blog.naver.com").toString();
      const { data: frameHtml } = await axios.get(absolute, {
        headers: { "User-Agent": UA },
        timeout: 15000
      });
      const _$ = cheerio.load(frameHtml);
      _$(".u_cbox_list .u_cbox_comment").each((_, el) => {
        const nick = _$(el).find(".u_cbox_nick").text().trim();
        const txt = _$(el).find(".u_cbox_contents").text().trim();
        if (txt) comments.push({ nick, text: txt });
      });
    }

    return res.status(200).json({
      url,
      count: comments.length,
      comments
    });
  } catch (e) {
    // 실패해도 서버가 안 죽게 안전하게 응답
    return res.status(200).json({
      url,
      count: 0,
      comments: [],
      note: "댓글을 DOM에서 찾지 못했어요(비공개/더보기/API호출형일 수 있음).",
      hint: "이럴 땐 본문 톤만 참고해서 댓글을 생성하세요."
    });
  }
}
