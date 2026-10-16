
const OpenAI = require("openai");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Use POST for diagnosis." })
    };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "AI service is not configured yet."
        })
      };
    }

    const data = JSON.parse(event.body || "{}");
    const crop = String(data.crop || "").trim().slice(0, 80);
    const symptoms = String(data.symptoms || "").trim().slice(0, 1500);
    const image = data.image;

    if (!crop || (!symptoms && !image)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Select a crop and provide symptoms or a photo."
        })
      };
    }

    if (
      image &&
      (typeof image !== "string" ||
       !/^data:image\/(jpeg|png|webp);base64,/.test(image) ||
       image.length > 4_000_000)
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Use a JPEG, PNG or WebP photo smaller than about 3 MB."
        })
      };
    }

    const openai = new OpenAI({ apiKey });

    const content = [
      {
        type: "text",
        text:
          "You are a careful crop-health assistant helping farmers in Kenya. " +
          "Crop: " + crop + ". Symptoms: " + (symptoms || "Not provided") +
          ". Describe likely causes, what visual signs to check, practical low-risk next steps, " +
          "and when to contact an agricultural officer. If a photo is supplied, inspect it. " +
          "State uncertainty and do not claim certainty from an unclear photo. " +
          "Do not invent pesticide doses or recommend mixing chemicals. " +
          "Use simple English and clearly label the response as an AI estimate, not a confirmed diagnosis."
      }
    ];

    if (image) {
      content.push({
        type: "image_url",
        image_url: { url: image, detail: "low" }
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content }],
      max_tokens: 600
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        guidance: response.choices[0].message.content
      })
    };
  } catch (error) {
    console.error("Diagnosis function error:", error.message);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Diagnosis could not be completed. Please try again later."
      })
    };
  }
};
