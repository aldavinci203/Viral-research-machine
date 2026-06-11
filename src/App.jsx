import { useState, useRef } from "react";

const APP_PASSWORD = "aldavincii2M";

const CREATOR_DNA = `
@aldavincii — TikTok creator approaching 1M followers
Content: Mother-son dynamic, spontaneous travel, comedy/reaction
Brand deals: Amazon, Netflix, Paramount, Lionsgate, Universal
Background: Film/TV degree, Baltimore MD
Key strength: Authentic chemistry with mom, spontaneous moments
Goal: Scale past 1M, go viral consistently
`;

const TIKTOK_ALGORITHM = `
TikTok Algorithm Ranking Signals (weighted):
1. COMPLETION RATE (35%) - % who watch to end. Under 15s: need 80%+. Under 60s: need 60%+
2. REWATCH RATE (20%) - loops. Loopable content gets 3-5x more push
3. SHARES (18%) - most powerful signal. 1 share = 3 likes in algorithm weight
4. COMMENTS (12%) - especially controversial or emotional comments that spark replies
5. LIKES (8%) - weakest signal but still counts
6. SAVES (7%) - signals high value content, gets pushed to For You
HOOK WINDOW: First 0.5 seconds determines if viewer swipes. First 3 seconds determines completion.
OPTIMAL LENGTH: 7-15s for maximum completion. 21-34s for storytelling. 60s+ needs strong narrative arc.
POSTING TIME: Best slots are 6-10am, 7-11pm local time. Tuesday-Friday outperform weekends by 23%.
HASHTAG STRATEGY: 3-5 specific niche tags > 10 broad tags. Never use #fyp alone.
SOUND: Original audio gets 1.4x reach. Trending audio gets 2.1x reach in first 48hrs.
CAPTIONS: Questions in captions increase comments by 40%. Controversial statements increase shares by 60%.
DUET/STITCH potential: Content that invites response gets 3x more organic reach.
`;


const C = {
  bg:"#07080F",surface:"#0D0F1C",card:"#111320",border:"#1C1F35",
  accent:"#7C6FFF",green:"#00E5A0",amber:"#FFB547",red:"#FF5C5C",
  pink:"#FF4ECD",blue:"#38BDF8",text:"#EEEEF5",muted:"#6B6F8A",dim:"#393D5C",
};

async function geminiText(key,prompt){
  const body={contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.8,maxOutputTokens:2048}};
  const res=await fetch("/api/gemini",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,body})});
  const d=await res.json();
  if(d.error)throw new Error("Gemini: "+(d.error.message||JSON.stringify(d.error)));
  return d.candidates?.[0]?.content?.parts?.[0]?.text||"";
}

async function apifyTikTokVideo(token,url){
  const res=await fetch("/api/apify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,body:{postURLs:[url],resultsPerPage:1,shouldDownloadVideos:false,shouldDownloadCovers:false,shouldDownloadSubtitles:true}})});
  const d=await res.json();
  if(!d||!d.length)throw new Error("Apify returned no data. Check the URL.");
  return d[0];
}

async function extractTranscript(video){
  if(video.subtitleLinks&&video.subtitleLinks.length>0){
    try{
      const engSub=video.subtitleLinks.find(s=>s.language==="eng-US"||s.language==="en")||video.subtitleLinks[0];
      if(engSub&&engSub.link){
        const res=await fetch("/api/proxy?url="+encodeURIComponent(engSub.link));
        if(res.ok){
          const raw=await res.text();
          const clean=raw.split("\n").filter(l=>!/^WEBVTT|^\d+$|-->/.test(l.trim())).join(" ").replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();
          if(clean.length>20)return clean;
        }
      }
    }catch(e){console.log("Sub failed",e.message);}
  }
  if(video.videoSuggestedWords&&video.videoSuggestedWords.length>0)return video.videoSuggestedWords.join(" ");
  if(video.ocrText)return video.ocrText;
  return video.desc||"No transcript available";
}

async function buildVideoContext(video){
  const fans=video.authorMeta?.fans||1;
  const views=video.playCount||0;
  const likes=video.diggCount||0;
  const comments=video.commentCount||0;
  const shares=video.shareCount||0;
  const duration=video.video?.duration||0;
  const shareRatio=views>0?((shares/views)*100).toFixed(2):0;
  const likeRatio=views>0?((likes/views)*100).toFixed(2):0;
  const commentRatio=views>0?((comments/views)*100).toFixed(2)*1:0;
  const transcript=await extractTranscript(video);
  const hashtags=(video.textExtra||[]).map(t=>t.hashtagName).filter(Boolean).join(", ")||"none";
  
  return {
    caption:video.desc||"No caption",
    transcript,
    views,likes,comments,shares,duration,fans,
    shareRatio,likeRatio,commentRatio,
    hashtags,
    music:video.musicMeta?.musicName||"unknown",
    isOriginalAudio:video.musicMeta?.musicOriginal||false,
    engagementRate:fans>0?((likes/fans)*100).toFixed(2):0,
    performanceSummary:`Views: ${fmt(views)} | Likes: ${fmt(likes)} | Comments: ${fmt(comments)} | Shares: ${fmt(shares)} | Duration: ${duration}s | Followers: ${fmt(fans)} | Share ratio: ${shareRatio}% | Like ratio: ${likeRatio}% | Eng rate: ${fans>0?((likes/fans)*100).toFixed(2):0}%`,
    fullText:`CAPTION: "${video.desc||"No caption"}"
TRANSCRIPT/SCRIPT: "${transcript}"
HASHTAGS: ${hashtags}
MUSIC: ${video.musicMeta?.musicName||"unknown"} (${video.musicMeta?.musicOriginal?"Original Audio":"Trending Audio"})
DURATION: ${duration}s
VIEWS: ${fmt(views)} | LIKES: ${fmt(likes)} | COMMENTS: ${fmt(comments)} | SHARES: ${fmt(shares)}
CREATOR FOLLOWERS: ${fmt(fans)}
SHARE RATIO: ${shareRatio}% (viral benchmark: >1%)
LIKE RATIO: ${likeRatio}% (viral benchmark: >5%)
COMMENT RATIO: ${commentRatio}% (viral benchmark: >0.3%)
ENGAGEMENT RATE: ${fans>0?((likes/fans)*100).toFixed(2):0}%`
  };
}

async function apifyTikTokProfile(token,username,count=20){
  const handle=username.replace("https://www.tiktok.com/@","").replace("@","").split("?")[0].trim();
  const res=await fetch("/api/apify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,body:{profiles:[handle],resultsPerPage:count,shouldDownloadVideos:false,shouldDownloadCovers:false}})});
  const d=await res.json();
  if(!d||!d.length)throw new Error("Apify couldn't find that profile. Make sure the account is public.");
  return d;
}

async function claude(system,user){
  const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-opus-4-5",max_tokens:1000,system,messages:[{role:"user",content:user}]})});
  const d=await res.json();
  if(d.error)throw new Error("Claude: "+d.error.message);
  return d.content[0].text;
}

function parseJSON(text){
  const m=text.match(/```json([\s\S]*?)```/);
  if(m){try{return JSON.parse(m[1].trim());}catch{}}
  try{return JSON.parse(text.trim());}catch{}
  return null;
}

function fmt(n){
  if(!n&&n!==0)return"—";
  if(n>=1000000)return(n/1000000).toFixed(1)+"M";
  if(n>=1000)return(n/1000).toFixed(1)+"K";
  return n.toString();
}

function Bar({label,score,color}){
  return(
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
        <span style={{fontSize:10,color:C.muted,letterSpacing:"0.12em",textTransform:"uppercase"}}>{label}</span>
        <span style={{fontSize:11,color,fontWeight:800}}>{score}<span style={{color:C.dim,fontWeight:400}}>/10</span></span>
      </div>
      <div style={{height:3,background:C.border,borderRadius:99}}>
        <div style={{height:"100%",width:`${score*10}%`,background:`linear-gradient(90deg,${color}88,${color})`,borderRadius:99,transition:"width 1s cubic-bezier(.4,0,.2,1)"}}/>
      </div>
    </div>
  );
}

function Chip({children,color=C.accent}){
  return <span style={{display:"inline-block",padding:"2px 9px",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",background:color+"20",color,marginRight:5,marginBottom:5,border:`1px solid ${color}30`}}>{children}</span>;
}

function Card({children,glow,style={}}){
  return <div style={{background:C.card,borderRadius:14,border:`1px solid ${glow?C.accent+"50":C.border}`,boxShadow:glow?`0 0 28px ${C.accent}18`:"none",padding:"18px 16px",marginBottom:14,...style}}>{children}</div>;
}

function Label({children,color=C.accent}){
  return <div style={{fontSize:9,fontWeight:800,letterSpacing:"0.18em",color,textTransform:"uppercase",marginBottom:10}}>{children}</div>;
}

function TInput({placeholder,value,onChange,type="text",rows}){
  const s={width:"100%",background:"#090B16",border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 13px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
  return rows?<textarea {...{placeholder,value,onChange,rows}} style={{...s,resize:"vertical"}}/>:<input {...{type,placeholder,value,onChange}} style={s}/>;
}

function Btn({children,onClick,disabled,color=C.accent,full}){
  return <button onClick={onClick} disabled={disabled} style={{width:full?"100%":"auto",padding:"12px 20px",border:"none",borderRadius:10,background:disabled?C.dim:`linear-gradient(135deg,${color},${color}BB)`,color:disabled?C.muted:"#fff",fontSize:13,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.6:1}}>{children}</button>;
}

function StatPill({label,value,color=C.accent}){
  return(
    <div style={{background:C.surface,borderRadius:10,padding:"10px 14px",textAlign:"center",border:`1px solid ${C.border}`}}>
      <div style={{fontSize:16,fontWeight:900,color}}>{value}</div>
      <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginTop:2}}>{label}</div>
    </div>
  );
}

function KeyInput({label,hint,value,onChange,saved,onSave,color=C.accent}){
  const [vis,setVis]=useState(false);
  return(
    <div style={{marginBottom:12}}>
      <div style={{fontSize:9,fontWeight:800,letterSpacing:"0.15em",color:saved?C.green:color,textTransform:"uppercase",marginBottom:7}}>{saved?"✓ ":""}{label}</div>
      <div style={{display:"flex",gap:7}}>
        <TInput type={vis?"text":"password"} placeholder={hint} value={value} onChange={e=>onChange(e.target.value)}/>
        <button onClick={()=>setVis(!vis)} style={{background:C.border,border:"none",borderRadius:8,color:C.muted,cursor:"pointer",padding:"0 10px",fontSize:13,flexShrink:0}}>{vis?"🙈":"👁"}</button>
        <Btn onClick={onSave} color={saved?C.green:color}>{saved?"✓":"Save"}</Btn>
      </div>
    </div>
  );
}

const effortColor=(e)=>e==="Low"?C.green:e==="Medium"?C.amber:C.red;

const TABS=[
  {id:"profile",label:"Profile",icon:"👤"},
  {id:"predict",label:"Predict",icon:"🎯"},
  {id:"competitor",label:"Competitor",icon:"🔍"},
  {id:"script",label:"Script",icon:"✍️"},
  {id:"analyze",label:"Analyze Me",icon:"🔬"},
  {id:"strategy",label:"Strategy",icon:"🧭"},
  {id:"brand",label:"Brand ID",icon:"⭐"},
  {id:"calendar",label:"Calendar",icon:"📅"},
  {id:"deepdive",label:"Deep Dive",icon:"🧠"},
  {id:"unblock",label:"Unblock",icon:"💡"},
];

const ANGLES=[
  {id:"mother-son",label:"Mother-Son 🤝"},
  {id:"travel",label:"Travel ✈️"},
  {id:"reaction",label:"Reaction 😂"},
  {id:"lifestyle",label:"Lifestyle 🎯"},
  {id:"brand",label:"Brand Deal 💰"},
];

export default function App(){
  const [unlocked,setUnlocked]=useState(false);
  const [pwInput,setPwInput]=useState("");
  const [pwError,setPwError]=useState(false);
  const [tab,setTab]=useState("profile");
  const [geminiKey,setGeminiKey]=useState("");
  const [geminiSaved,setGeminiSaved]=useState(false);
  const [apifyKey,setApifyKey]=useState("");
  const [apifySaved,setApifySaved]=useState(false);
  const [loading,setLoading]=useState(false);
  const [loadMsg,setLoadMsg]=useState("");
  const [error,setError]=useState("");

  const [profileHandle,setProfileHandle]=useState("");
  const [profileCount,setProfileCount]=useState(20);
  const [profileResult,setProfileResult]=useState(null);

  const predictRef=useRef(null);
  const [predictFile,setPredictFile]=useState(null);
  const [predictPreview,setPredictPreview]=useState("");
  const [predictResult,setPredictResult]=useState(null);

  const [compUrl,setCompUrl]=useState("");
  const [compResult,setCompResult]=useState(null);

  const [scriptTopic,setScriptTopic]=useState("");
  const [scriptAngle,setScriptAngle]=useState("mother-son");
  const [scriptResult,setScriptResult]=useState(null);

  const [myUrl,setMyUrl]=useState("");
  const [myMode,setMyMode]=useState("url");
  const [myText,setMyText]=useState("");
  const [myResult,setMyResult]=useState(null);

  const [strategyResult,setStrategyResult]=useState(null);
  const [brandResult,setBrandResult]=useState(null);
  const [calFocus,setCalFocus]=useState("mixed");
  const [calResult,setCalResult]=useState(null);
  const [blockFeeling,setBlockFeeling]=useState("");
  const [unblockResult,setUnblockResult]=useState(null);
  const [deepUrl,setDeepUrl]=useState("");
  const [deepMode,setDeepMode]=useState("url");
  const [deepText,setDeepText]=useState("");
  const [deepResult,setDeepResult]=useState(null);

  const run=async(fn)=>{setError("");setLoading(true);try{await fn();}catch(e){setError(e.message);}setLoading(false);setLoadMsg("");};

  // ── PROFILE ──────────────────────────────────────────────────────────────────
  const runProfile=()=>run(async()=>{
    if(!apifySaved)throw new Error("Apify token required for profile analysis.");
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    if(!profileHandle)throw new Error("Enter a TikTok profile URL or handle.");
    setLoadMsg(`Pulling last ${profileCount} videos...`);
    const videos=await apifyTikTokProfile(apifyKey,profileHandle,profileCount);
    const totalViews=videos.reduce((a,v)=>a+(v.playCount||0),0);
    const totalLikes=videos.reduce((a,v)=>a+(v.diggCount||0),0);
    const totalComments=videos.reduce((a,v)=>a+(v.commentCount||0),0);
    const totalShares=videos.reduce((a,v)=>a+(v.shareCount||0),0);
    const avgViews=Math.round(totalViews/videos.length);
    const avgEngagement=videos[0]?.authorMeta?.fans?((totalLikes/videos.length)/videos[0].authorMeta.fans*100).toFixed(2):null;
    const sorted=[...videos].sort((a,b)=>(b.playCount||0)-(a.playCount||0));
    const top5=sorted.slice(0,5);
    const bottom5=sorted.slice(-5);
    setLoadMsg("AI analyzing your content patterns...");
    const videoData=videos.map((v,i)=>({
      rank:i+1,
      caption:v.desc||"No caption",
      views:v.playCount||0,
      likes:v.diggCount||0,
      comments:v.commentCount||0,
      shares:v.shareCount||0,
      duration:v.video?.duration||0,
      hashtags:(v.textExtra||[]).map(t=>t.hashtagName).filter(Boolean).slice(0,5).join(", ")||"none",
    }));
    const raw=await claude(
      `You are a data-driven TikTok analyst. Analyze this creator's actual video data with zero assumptions — only what the numbers and captions tell you. Be brutally honest and specific. Reference actual video titles and stats. Return ONLY valid JSON in \`\`\`json blocks with this exact structure:
{"overallGrade":"A/B/C/D","channelHealth":7,"consistencyScore":7,"hookStrengthAvg":7,"engagementScore":7,"growthMomentum":7,"executiveSummary":"2-3 honest sentences based purely on the data","topPatterns":["specific pattern from actual top videos","pattern2","pattern3"],"floppingPatterns":["specific pattern from actual low videos","pattern2"],"bestContentType":"based purely on what the data shows","worstContentType":"based purely on data","avgViewsRead":"1 honest sentence interpreting average views","hiddenStrength":"something surprising the data reveals","biggestLeak":"the single biggest problem the data shows","contentGaps":["gap1","gap2","gap3"],"doubleDown":"exactly what to post more of based on data","dropImmediately":"what to stop based on data","next30Days":"specific action plan based on this data","pathTo2M":"realistic path based on current trajectory"}`,
      `Creator: ${profileHandle}\nFollowers: ${fmt(videos[0]?.authorMeta?.fans)}\nTotal views (last ${videos.length} videos): ${fmt(totalViews)}\nAvg views/video: ${fmt(avgViews)}\nAvg engagement rate: ${avgEngagement?avgEngagement+"%":"N/A"}\nTotal likes: ${fmt(totalLikes)}, comments: ${fmt(totalComments)}, shares: ${fmt(totalShares)}\n\nTOP 5 VIDEOS:\n${top5.map((v,i)=>`${i+1}. Caption: "${v.desc?.slice(0,100)||"No caption"}" | Views: ${fmt(v.playCount)} | Likes: ${fmt(v.diggCount)} | Shares: ${fmt(v.shareCount)} | Duration: ${v.video?.duration}s | Tags: ${(v.textExtra||[]).map(t=>t.hashtagName).filter(Boolean).join(", ")||"none"}`).join("\n")}\n\nBOTTOM 5 VIDEOS:\n${bottom5.map((v,i)=>`${i+1}. Caption: "${v.desc?.slice(0,100)||"No caption"}" | Views: ${fmt(v.playCount)} | Likes: ${fmt(v.diggCount)} | Duration: ${v.video?.duration}s`).join("\n")}\n\nALL VIDEOS DATA:\n${videoData.map(v=>`Caption: "${v.caption.slice(0,80)}" | Views: ${fmt(v.views)} | Likes: ${fmt(v.likes)} | Shares: ${fmt(v.shares)} | ${v.duration}s | Tags: ${v.hashtags}`).join("\n")}`
    );
    const parsed=parseJSON(raw);
    setProfileResult({
      ...(parsed||{raw}),
      stats:{totalViews,totalLikes,totalComments,totalShares,avgViews,avgEngagement,followers:videos[0]?.authorMeta?.fans},
      top5,bottom5,videoCount:videos.length,allVideos:videoData
    });
  });

  // ── PREDICT ──────────────────────────────────────────────────────────────────
  const runPredict=async()=>{
    setError("");setLoading(true);
    try{
      if(!geminiSaved)throw new Error("Connect Gemini key first.");
      if(!predictFile)throw new Error("Upload a video first.");
      setLoadMsg("Reading your video file...");
      const reader=new FileReader();
      const base64=await new Promise((res,rej)=>{reader.onload=e=>res(e.target.result.split(",")[1]);reader.onerror=rej;reader.readAsDataURL(predictFile);});
      
      setLoadMsg("Gemini watching every frame of your video...");
      const geminiBody={
        contents:[{parts:[
          {text:`You are a TikTok viral expert who thinks exactly like a viewer scrolling at 2am AND like the TikTok algorithm simultaneously.

Watch this entire video carefully — every frame, every word spoken, every visual transition, every sound.

Then give the most detailed, specific, actionable analysis possible. Reference ACTUAL moments you see in the video. Quote ACTUAL words spoken. Identify EXACT timestamps where things work or fail.

Analyze:

HOOK (0-3 seconds):
- What is the EXACT first visual a viewer sees?
- What are the EXACT first words spoken?
- Does it create an open loop? Curiosity gap? Pattern interrupt?
- Would a cold audience (non-follower) stop scrolling? Why or why not?
- Rate the hook 1-10

SCRIPT & PACING:
- Quote the actual opening line word for word
- Are sentences short and punchy or long and slow?
- Where does the energy peak?
- Where does it dip?
- Is there a clear setup → tension → payoff structure?
- What specific line would make someone share this?
- What specific line would make someone comment?

VISUAL DIRECTION:
- Camera angles used
- Cuts and transitions — too slow? Too fast?
- Text overlays — are they effective?
- Facial expressions and energy — authentic or forced?
- B-roll or variety in shots?

AUDIO:
- Is it original audio or trending sound?
- Does the music match the energy?
- Is the speaker's voice clear and engaging?
- Any audio issues?

ALGORITHM SIGNALS:
- Loop potential — does the ending connect back to the beginning?
- Comment bait — does anything spark debate or strong reaction?
- Share trigger — is there a "I need to send this" moment?
- Save trigger — is there anything worth saving?
- Duet/Stitch potential?

VIEWER PSYCHOLOGY:
- What does a viewer think in the first 0.5 seconds?
- What makes them stay past 3 seconds?
- What is the exact emotional journey?
- Where do most viewers likely drop off and why?
- What thought would make someone share this?

Return ONLY valid JSON in \`\`\`json blocks:
{
  "verdict": "POST IT / NEEDS WORK / RESHOOT",
  "viralProbability": "X% chance of hitting 100K",
  "predictedViews": "realistic range",
  "confidence": "Low/Medium/High",
  "overallViralScore": 8,
  "hookScore": 8,
  "retentionScore": 8,
  "shareabilityScore": 8,
  "emotionScore": 8,
  "loopScore": 8,
  "commentBaitScore": 8,
  "algorithmGrade": "A/B/C/D/F",
  "exactOpeningLine": "quote the actual first words spoken",
  "exactHook": "describe exactly what happens in first 3 seconds",
  "hookAnalysis": "detailed honest assessment of the hook",
  "hookScore_reasoning": "why you gave this hook score",
  "scriptAnalysis": {
    "pacing": "assessment of pacing",
    "peakMoment": "the single best moment in the video",
    "weakMoment": "the single weakest moment",
    "shareableLine": "the exact line most likely to cause shares",
    "commentableLine": "the exact line most likely to cause comments",
    "narrativeArc": "does it have setup tension payoff?"
  },
  "visualAnalysis": {
    "cameraWork": "assessment",
    "editing": "assessment",
    "textOverlays": "assessment",
    "creatorEnergy": "assessment"
  },
  "audioAnalysis": {
    "type": "Original/Trending",
    "effectiveness": "assessment",
    "clarity": "assessment"
  },
  "viewerPsychology": {
    "firstHalfSecond": "exactly what viewer sees and thinks",
    "threeSecondTest": "STAY or SWIPE and exact reason",
    "emotionalJourney": "the complete emotional arc",
    "dropOffPoint": "exact moment and reason most viewers leave",
    "shareThought": "the exact thought that makes someone share"
  },
  "algorithmSignals": {
    "loopPotential": "assessment",
    "commentBait": "assessment",
    "shareTrigger": "assessment",
    "saveTrigger": "assessment",
    "stitchDuetPotential": "assessment"
  },
  "retentionKillers": ["specific moment 1", "moment 2", "moment 3"],
  "retentionBoosts": ["specific moment 1", "moment 2"],
  "rewrittenHook": "the exact rewritten opening that would perform 3x better",
  "fixBeforePosting": ["specific fix 1", "specific fix 2", "specific fix 3", "fix 4"],
  "viralVersion": "scene by scene description of how to reshoot this to hit 1M views",
  "rewrittenCaption": "optimized caption with hashtags",
  "bestTimeToPost": "specific day and time with reasoning",
  "competitorAngle": "how a top creator would approach this exact topic",
  "confidenceScore": "X% confidence in this analysis"
}`},
          {inline_data:{mime_type:predictFile.type||"video/mp4",data:base64}}
        ]}],
        generationConfig:{temperature:0.3,maxOutputTokens:4096}
      };
      const res=await fetch("/api/gemini",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:geminiKey,body:geminiBody})});
      const d=await res.json();
      if(d.error)throw new Error("Gemini: "+(d.error.message||JSON.stringify(d.error)));
      const text=d.candidates?.[0]?.content?.parts?.[0]?.text||"";
      
      // Now run Claude on top of Gemini's analysis for strategy layer
      setLoadMsg("Claude building your viral strategy...");
      const geminiAnalysis=parseJSON(text);
      if(geminiAnalysis){
        try{
          const claudeEnhancement=await claude(
            `You are a TikTok growth strategist. Gemini has watched this video and provided detailed analysis. Your job is to add the strategic growth layer on top.
Creator context: ${CREATOR_DNA}
Algorithm knowledge: ${TIKTOK_ALGORITHM}
Based on Gemini's analysis, provide strategic recommendations that are specific to this creator's growth goals.`,
            `Gemini's video analysis: ${JSON.stringify(geminiAnalysis)}
            
Add to this analysis:
1. How does this video fit into the creator's overall content strategy?
2. What pattern does this video establish or break?
3. What should the next 3 videos be to capitalize on this one?
4. What specific algorithm play is being missed?
5. Growth trajectory prediction if they post this vs reshoot it

Return additional JSON fields to merge: {"strategyNote":"specific strategic insight","nextThreeVideos":["video 1 concept","video 2","video 3"],"algorithmPlay":"the specific algorithm strategy being missed","growthTrajectory":"prediction if posted as-is vs after fixes","brandAlignment":"how this fits the creator brand 1-10 and why"}`
          );
          const claudeData=parseJSON(claudeEnhancement);
          setPredictResult({...geminiAnalysis,...(claudeData||{})});
        }catch(e){setPredictResult(geminiAnalysis);}
      } else {
        setPredictResult({raw:text});
      }
    }catch(e){setError(e.message);}
    setLoading(false);setLoadMsg("");
  };

  // ── COMPETITOR ───────────────────────────────────────────────────────────────
  const runCompetitor=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    if(!compUrl)throw new Error("Paste a specific TikTok video URL.");
    let engagementData=null,engBlock="Apify not connected.";
    if(apifySaved){
      setLoadMsg("Apify pulling transcript + stats...");
      try{
        engagementData=await apifyTikTokVideo(apifyKey,compUrl);
        const ctx=await buildVideoContext(engagementData);
        engBlock=ctx.fullText;
      }catch(e){engBlock="Apify error: "+e.message;}
    }
    setLoadMsg("AI analyzing the video...");
    const videoAnalysis=await geminiText(geminiKey,`Analyze this TikTok URL for viral patterns: ${compUrl}\n\nEngagement data:\n${engBlock}\n\nAnalyze: hook structure first 3 seconds, pacing, emotional driver, what makes people watch till the end, shareability factors, editing style. Be specific and data-driven.`);
    setLoadMsg("Building your cheat sheet...");
    const raw=await claude(
      `You are a viral content analyst. Based on the video analysis and engagement data provided, extract the viral formula. Return ONLY valid JSON in \`\`\`json blocks:
{"title":"punchy name for this formula","viralScore":8,"hookScore":8,"retentionScore":8,"shareabilityScore":8,"emotionScore":8,"performanceSummary":"1 sentence on actual performance based on real numbers","hookBreakdown":"exactly what the hook does in 2 sentences","structure":["beat 1 with timing","beat 2","beat 3","beat 4","beat 5"],"whyItWorks":"core viral mechanics 2-3 sentences","emotionalDriver":"primary emotion","formula":"the replicable formula in one sentence","steal":["specific thing 1 to copy","thing 2","thing 3"],"avoid":["specific weakness 1"],"tags":["tag1","tag2","tag3"]}`,
      `Video analysis:\n${videoAnalysis}\n\nEngagement data:\n${engBlock}\n\nURL: ${compUrl}`
    );
    setCompResult({...(parseJSON(raw)||{raw}),engagement:engagementData});
  });

  // ── SCRIPT ───────────────────────────────────────────────────────────────────
  const runScript=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    if(!scriptTopic)throw new Error("Enter a video topic.");
    setLoadMsg("Writing your script...");
    const raw=await geminiText(geminiKey,
      `You are a viral TikTok scriptwriter. Write a script for this topic and angle. Make it authentic, not generic.
Topic: ${scriptTopic}
Angle: ${scriptAngle}
Return ONLY valid JSON in \`\`\`json blocks:
{"title":"video concept title","hook":"exact first line or action 0-2s","whyThisHook":"why this stops the scroll","script":[{"beat":"Hook","action":"exactly what you do","dialogue":"exactly what you say","duration":"0-3s"},{"beat":"Setup","action":"...","dialogue":"...","duration":"3-8s"},{"beat":"Turn","action":"...","dialogue":"...","duration":"8-20s"},{"beat":"Payoff","action":"...","dialogue":"...","duration":"20-35s"},{"beat":"CTA","action":"...","dialogue":"...","duration":"35-45s"}],"visualDirection":"specific camera angles cuts overlays","soundStrategy":"specific music or audio recommendation","caption":"full ready-to-post TikTok caption with hashtags","viralPotential":8,"whyItWillWork":"2 specific sentences"}`
    );
    setScriptResult(parseJSON(raw)||{raw});
  });

  // ── ANALYZE ME ───────────────────────────────────────────────────────────────
  const runAnalyzeMe=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    let myEngagement=null,engBlock="No stats available.";
    if(apifySaved&&myMode==="url"&&myUrl){
      setLoadMsg("Apify pulling your transcript + stats...");
      try{
        myEngagement=await apifyTikTokVideo(apifyKey,myUrl);
        const ctx=buildVideoContext(myEngagement);
        engBlock=ctx.fullText;
      }catch(e){engBlock="Apify error: "+e.message;}
    }
    let videoAnalysis=myMode==="url"?"":`Creator's description: ${myText}`;
    if(myMode==="url"&&myUrl){
      setLoadMsg("Analyzing your video...");
      videoAnalysis=await geminiText(geminiKey,`Analyze this TikTok video: ${myUrl}\n\nStats: ${engBlock}\n\nGive an honest unbiased analysis of: hook quality, structure, pacing, editing, emotional tone, what works, what's missing. Be direct.`);
    }
    setLoadMsg("Building your breakdown...");
    const raw=await claude(
      `You are a senior TikTok growth strategist. Give brutally honest analysis based purely on the data. No flattery. Return ONLY valid JSON in \`\`\`json blocks:
{"overallScore":7,"hookScore":7,"retentionScore":7,"brandScore":7,"growthScore":7,"numbersRead":"1 honest sentence interpreting the actual stats","whatWorked":["specific win based on data","win2","win3"],"whatMissed":["specific miss","miss2"],"hookAnalysis":"honest 2-sentence assessment","brandAnalysis":"what this video says about the creator's brand","ceiling":"exactly what is limiting this video","breakthroughMove":"the ONE specific change that would have doubled performance","patternInsight":"what this reveals about content patterns","nextVideo":"exactly what to film next based on this data","directNote":"direct honest message about growth"}`,
      `Video analysis:\n${videoAnalysis}\n\nStats:\n${engBlock}`
    );
    setMyResult({...(parseJSON(raw)||{raw}),engagement:myEngagement});
  });

  // ── STRATEGY ─────────────────────────────────────────────────────────────────
  const runStrategy=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    setLoadMsg("Building your strategy...");
    const profileInfo=profileResult?`Based on real profile data analyzed:\n- Avg views: ${fmt(profileResult.stats?.avgViews)}\n- Engagement rate: ${profileResult.stats?.avgEngagement}%\n- Best content: ${profileResult.bestContentType}\n- Biggest leak: ${profileResult.biggestLeak}`:"No profile data yet — run Profile Analysis first for data-driven strategy.";
    const raw=await geminiText(geminiKey,
      `You are a TikTok growth strategist. Build a data-driven strategy based on what you actually know from the analysis. ${profileInfo}
Return ONLY valid JSON in \`\`\`json blocks:
{"coreIdentity":"what this creator is based on their content","biggestAsset":"most powerful underutilized asset based on data","niches":[{"name":"niche","why":"why based on data","potential":"growth potential","competitors":"who owns this","howToWin":"specific angle","urgency":"why now","difficulty":"Easy/Medium/Hard"},{"name":"...","why":"...","potential":"...","competitors":"...","howToWin":"...","urgency":"...","difficulty":"..."},{"name":"...","why":"...","potential":"...","competitors":"...","howToWin":"...","urgency":"...","difficulty":"..."},{"name":"...","why":"...","potential":"...","competitors":"...","howToWin":"...","urgency":"...","difficulty":"..."}],"topNiche":"top recommendation and why","brandGaps":["gap1","gap2","gap3"],"revenueAngles":["angle1","angle2","angle3"],"milestoneRoadmap":["to 1M","to 2M","to 5M"],"hardTruth":"the honest thing holding this creator back"}`
    );
    setStrategyResult(parseJSON(raw)||{raw});
  });

  // ── BRAND ID ─────────────────────────────────────────────────────────────────
  const runBrand=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    setLoadMsg("Defining your brand...");
    const dataContext=profileResult?`Based on real content analysis:\n- Best performing content: ${profileResult.bestContentType}\n- Top video captions: ${profileResult.top5?.map(v=>v.desc?.slice(0,60)).join(" | ")}\n- Hidden strength: ${profileResult.hiddenStrength}`:"Provide general brand framework.";
    const raw=await geminiText(geminiKey,
      `You are a brand strategist. Define this creator's brand based on their actual content. ${dataContext}
Return ONLY valid JSON in \`\`\`json blocks:
{"brandStatement":"one powerful sentence","tagline":"5 words or less","coreValues":["value with explanation","value2","value3"],"audience":{"primary":"who watches now","aspirational":"who to target next","psychographic":"what they believe"},"contentPillars":[{"pillar":"name","description":"what this looks like","percentage":"%"},{"pillar":"...","description":"...","percentage":"..."},{"pillar":"...","description":"...","percentage":"..."},{"pillar":"...","description":"...","percentage":"..."}],"toneOfVoice":["trait1","trait2","trait3"],"whatMakesYouDifferent":"specific differentiator","whatToStop":"what dilutes the brand","brandComps":["similar creator/brand1","comp2","comp3"],"northStar":"vision at 5M followers"}`
    );
    setBrandResult(parseJSON(raw)||{raw});
  });

  // ── CALENDAR ─────────────────────────────────────────────────────────────────
  const runCalendar=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    setLoadMsg("Building your calendar...");
    const dataContext=profileResult?`Based on real performance data:\n- What works: ${profileResult.doubleDown}\n- What to stop: ${profileResult.dropImmediately}\n- Best content type: ${profileResult.bestContentType}`:"No profile data — generating general calendar.";
    const raw=await geminiText(geminiKey,
      `You are a TikTok content strategist. Build a 7-day calendar. Focus: ${calFocus}. ${dataContext}
Return ONLY valid JSON in \`\`\`json blocks:
{"weekTheme":"theme","days":[{"day":"Monday","concept":"specific concept","hook":"exact opening hook","angle":"content angle","effort":"Low/Medium/High","viralPotential":8,"notes":"tip"},{"day":"Tuesday","concept":"...","hook":"...","angle":"...","effort":"Low","viralPotential":7,"notes":"..."},{"day":"Wednesday","concept":"...","hook":"...","angle":"...","effort":"Medium","viralPotential":9,"notes":"..."},{"day":"Thursday","concept":"...","hook":"...","angle":"...","effort":"Low","viralPotential":7,"notes":"..."},{"day":"Friday","concept":"...","hook":"...","angle":"...","effort":"High","viralPotential":9,"notes":"..."},{"day":"Saturday","concept":"...","hook":"...","angle":"...","effort":"Medium","viralPotential":8,"notes":"..."},{"day":"Sunday","concept":"...","hook":"...","angle":"...","effort":"Low","viralPotential":6,"notes":"..."}],"heroVideo":"which day is the hero and why","repurposeTip":"how to turn one video into 3 pieces"}`
    );
    setCalResult(parseJSON(raw)||{raw});
  });

  // ── UNBLOCK ──────────────────────────────────────────────────────────────────
  const runUnblock=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    setLoadMsg("Working through your block...");
    const raw=await geminiText(geminiKey,
      `You are a creative director helping a TikTok creator through a creative block. Be warm, direct, and specific. The creator is feeling: "${blockFeeling||"general creative block and uncertainty"}".
Return ONLY valid JSON in \`\`\`json blocks:
{"reframe":"what this block is actually telling them","rootCause":"the likely real reason behind the block","immediateAction":"one specific thing to do TODAY","ideas":[{"title":"specific idea","hook":"exact opening hook","angle":"content angle","viralPotential":8,"whyNow":"why this idea is right for this moment","effort":"Low/Medium/High"},{"title":"...","hook":"...","angle":"...","viralPotential":7,"whyNow":"...","effort":"..."},{"title":"...","hook":"...","angle":"...","viralPotential":9,"whyNow":"...","effort":"..."},{"title":"...","hook":"...","angle":"...","viralPotential":8,"whyNow":"...","effort":"..."},{"title":"...","hook":"...","angle":"...","viralPotential":7,"whyNow":"...","effort":"..."},{"title":"...","hook":"...","angle":"...","viralPotential":8,"whyNow":"...","effort":"..."}],"mindsetShift":"direct mindset shift needed","reminder":"a specific reminder about progress made","nextStep":"practical literal next step"}`
    );
    setUnblockResult(parseJSON(raw)||{raw});
  });


  // ── DEEP DIVE ─────────────────────────────────────────────────────────────────
  const runDeepDive=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    const input=deepMode==="url"?deepUrl:deepText;
    if(!input)throw new Error(deepMode==="url"?"Paste a TikTok URL.":"Describe your video.");
    
    let statsBlock="No stats available — describe the video manually for analysis.";
    let videoEngagement=null;
    let videoContext=null;
    if(apifySaved&&deepMode==="url"){
      setLoadMsg("Apify pulling transcript + engagement data...");
      try{
        videoEngagement=await apifyTikTokVideo(apifyKey,deepUrl);
        videoContext=buildVideoContext(videoEngagement);
        statsBlock=videoContext.fullText;
        setLoadMsg("Gemini analyzing script and video...");
      }catch(e){statsBlock="Apify error: "+e.message;}
    }

    // Gemini ALWAYS runs — analyzes whatever data we have
    setLoadMsg("Gemini analyzing video content...");
    let geminiScriptAnalysis = "";
    try{
      const transcriptSection = videoContext&&videoContext.transcript&&videoContext.transcript!=="No transcript available"
        ? `ACTUAL TRANSCRIPT (spoken words): "${videoContext.transcript}"`
        : `NO TRANSCRIPT AVAILABLE — analyze based on caption and performance data`;
      
      const captionSection = videoContext
        ? `CAPTION: "${videoContext.caption}"
HASHTAGS: ${videoContext.hashtags}
MUSIC: ${videoContext.music} (${videoContext.isOriginalAudio?"Original Audio":"Trending Audio"})
DURATION: ${videoContext.duration}s`
        : deepMode==="manual" ? `CREATOR DESCRIPTION: ${deepText}` : "No data available";

      const performanceSection = videoContext
        ? `PERFORMANCE: ${videoContext.performanceSummary}
SHARE RATIO: ${videoContext.shareRatio}% | LIKE RATIO: ${videoContext.likeRatio}% | COMMENT RATIO: ${videoContext.commentRatio}%`
        : "No performance data";

      geminiScriptAnalysis = await geminiText(geminiKey,
        `You are a TikTok content analyst who thinks like both a viewer AND the algorithm. Analyze this video deeply.

${transcriptSection}

${captionSection}

${performanceSection}

Analyze ALL of the following:
1. HOOK ANALYSIS — first words/sentence, does it stop the scroll? Why or why not?
2. SCRIPT PACING — are sentences short and punchy or slow and long?
3. EMOTIONAL TRIGGERS — which specific words or phrases create emotion?
4. NARRATIVE ARC — is there a setup, tension, payoff structure?
5. CALL TO ACTION — is there one? Is it effective?
6. DROP-OFF PREDICTION — what specific moment likely caused people to leave?
7. SHARE TRIGGER — what specific moment likely caused shares?
8. CAPTION EFFECTIVENESS — does the caption drive comments? Does it have a hook?
9. HASHTAG STRATEGY — are the hashtags optimal for reach?
10. MUSIC CHOICE — does original vs trending audio help or hurt?
11. REWRITTEN HOOK — give a stronger version of the opening hook
12. MISSING ELEMENTS — what do top viral creators include that this video is missing?

Be extremely specific. Reference actual words from the transcript or caption. Give actionable insights not generic advice.`
      );
    }catch(e){geminiScriptAnalysis="Gemini analysis error: "+e.message;}

    setLoadMsg("Claude synthesizing everything...");
    const raw=await claude(
      `You are a TikTok algorithm expert AND viewer psychology specialist AND script analyst. You have THREE data sources to work with:
1. Real engagement numbers from Apify
2. The actual video transcript/script
3. Gemini's script analysis

Cross-reference all three to give the most accurate analysis possible. Think like a viewer, analyze like an algorithm, dissect like a scriptwriter.

TIKTOK ALGORITHM KNOWLEDGE:
${TIKTOK_ALGORITHM}

CREATOR CONTEXT:
${CREATOR_DNA}

GEMINI SCRIPT ANALYSIS:
${geminiScriptAnalysis||"Not available — URL-based analysis only"}

Your job: Give a deep, specific, actionable analysis referencing ACTUAL WORDS from the transcript, ACTUAL NUMBERS from the data, and SPECIFIC MOMENTS. Not generic advice.

Return ONLY valid JSON in \`\`\`json blocks:
{
  "viralProbability": "X% chance of hitting 100K",
  "algorithmScore": 1-10,
  "viewerScore": 1-10,
  "hookScore": 1-10,
  "retentionScore": 1-10,
  "shareabilityScore": 1-10,
  "loopScore": 1-10,
  "commentBaitScore": 1-10,
  "algorithmGrade": "A/B/C/D/F",
  "algorithmReport": {
    "completionRateEstimate": "estimated % who watched to end",
    "rewatchPotential": "Low/Medium/High - why",
    "shareDriver": "what would make someone share this",
    "commentDriver": "what would make someone comment",
    "saveDriver": "what would make someone save this",
    "soundStrategy": "assessment of audio choice",
    "hashtagEfficiency": "assessment of hashtag strategy"
  },
  "viewerPsychology": {
    "firstHalfSecond": "what a viewer thinks in first 0.5 seconds",
    "threeSecondTest": "do they stay or swipe at 3 seconds and why",
    "emotionalJourney": "the exact emotional arc a viewer experiences",
    "dropOffPoint": "the exact moment most viewers leave and why",
    "shareThought": "the exact thought that would make someone share"
  },
  "secondBySecond": [
    {"timestamp":"0-3s","what":"what happens","viewerReaction":"what viewer thinks/feels","algorithmSignal":"what this tells the algorithm"},
    {"timestamp":"3-10s","what":"...","viewerReaction":"...","algorithmSignal":"..."},
    {"timestamp":"10-20s","what":"...","viewerReaction":"...","algorithmSignal":"..."},
    {"timestamp":"20-end","what":"...","viewerReaction":"...","algorithmSignal":"..."}
  ],
  "hookAutopsy": "second-by-second breakdown of exactly what the hook does right or wrong",
  "retentionKillers": ["specific moment that kills retention 1","moment2","moment3"],
  "retentionBoosts": ["specific moment that boosts retention 1","moment2"],
  "algorithmFixes": ["specific fix to boost algorithm score 1","fix2","fix3","fix4"],
  "rewrittenHook": "the exact rewritten hook that would perform 3x better",
  "rewrittenCaption": "rewritten caption optimized for comments and algorithm",
  "optimalPostTime": "specific day and time with reasoning",
  "viralVersion": "exactly how to reshoot this video to hit 1M views — specific scene by scene",
  "competitorAngle": "how a top creator would approach this same topic",
  "verdict": "POST NOW / RESHOOT FIRST / CONCEPT CHANGE NEEDED",
  "confidenceScore": "X% confidence in this analysis"
}`,
      `${deepMode==="url"?`Video URL: ${deepUrl}`:`Creator's description: ${deepText}`}

${statsBlock}`
    );
    setDeepResult({...(parseJSON(raw)||{raw}),engagement:videoEngagement});
  });

  // ── PASSWORD SCREEN ───────────────────────────────────────────────────────────
  if(!unlocked){
    return(
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Inter',-apple-system,sans-serif"}}>
        <style>{`*{box-sizing:border-box;} input{color-scheme:dark;}`}</style>
        <div style={{width:"100%",maxWidth:380}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{width:56,height:56,borderRadius:16,background:`linear-gradient(135deg,${C.accent},#B06FFF)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>⚡</div>
            <div style={{fontSize:22,fontWeight:900,letterSpacing:"-0.025em",color:C.text,marginBottom:6}}>Viral Research Machine</div>
            <div style={{fontSize:12,color:C.muted}}>PRIVATE ACCESS ONLY</div>
          </div>
          <div style={{background:C.card,borderRadius:16,border:`1px solid ${C.border}`,padding:24}}>
            <div style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Password</div>
            <input type="password" placeholder="Enter password..." value={pwInput}
              onChange={e=>{setPwInput(e.target.value);setPwError(false);}}
              onKeyDown={e=>e.key==="Enter"&&(pwInput===APP_PASSWORD?setUnlocked(true):setPwError(true))}
              style={{width:"100%",background:"#090B16",border:pwError?`1px solid ${C.red}`:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:10,fontFamily:"inherit"}}
            />
            {pwError&&<div style={{fontSize:12,color:C.red,marginBottom:10}}>Wrong password. Try again.</div>}
            <button onClick={()=>pwInput===APP_PASSWORD?setUnlocked(true):setPwError(true)}
              style={{width:"100%",padding:13,background:`linear-gradient(135deg,${C.accent},#B06FFF)`,border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
              Unlock ⚡
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN APP ─────────────────────────────────────────────────────────────────
  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:80}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box;} textarea,input{color-scheme:dark;}`}</style>

      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"20px 18px 0"}}>
        <div style={{maxWidth:680,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:18}}>
            <div style={{width:38,height:38,borderRadius:11,background:`linear-gradient(135deg,${C.accent},#B06FFF)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>⚡</div>
            <div>
              <div style={{fontSize:17,fontWeight:900,letterSpacing:"-0.025em"}}>Viral Research Machine</div>
              <div style={{fontSize:10,color:C.muted,letterSpacing:"0.12em",marginTop:1}}>GEMINI + APIFY + CLAUDE · PURE DATA MODE</div>
            </div>
          </div>
          <div style={{display:"flex",overflowX:"auto",scrollbarWidth:"none",gap:0}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{flexShrink:0,padding:"9px 12px",border:"none",cursor:"pointer",background:"transparent",fontSize:11,fontWeight:tab===t.id?800:500,color:tab===t.id?C.accent:C.muted,borderBottom:`2px solid ${tab===t.id?C.accent:"transparent"}`,transition:"all 0.15s",whiteSpace:"nowrap"}}>{t.icon} {t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto",padding:"20px 18px"}}>

        <Card glow={geminiSaved&&apifySaved}>
          <Label color={geminiSaved&&apifySaved?C.green:C.amber}>{geminiSaved&&apifySaved?"✓ All Systems Connected":"Connect Your APIs"}</Label>
          <KeyInput label="Gemini API Key" hint="aistudio.google.com → Get API Key" value={geminiKey} onChange={v=>{setGeminiKey(v);setGeminiSaved(false);}} saved={geminiSaved} onSave={()=>geminiKey.length>10&&setGeminiSaved(true)} color={C.accent}/>
          <KeyInput label="Apify API Token" hint="apify.com → Settings → API & Integrations" value={apifyKey} onChange={v=>{setApifyKey(v);setApifySaved(false);}} saved={apifySaved} onSave={()=>apifyKey.length>10&&setApifySaved(true)} color={C.amber}/>
          <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>Gemini analyzes videos · Apify pulls real data · Claude builds strategy · <span style={{color:C.dim}}>Keys stay in your browser only.</span></div>
        </Card>

        {error&&<div style={{background:"#1A0808",border:`1px solid ${C.red}40`,borderRadius:10,padding:"11px 14px",marginBottom:14,fontSize:13,color:C.red}}>⚠ {error}</div>}
        {loading&&(
          <div style={{background:C.card,border:`1px solid ${C.accent}30`,borderRadius:10,padding:"13px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:15,height:15,border:`2px solid ${C.accent}`,borderTop:"2px solid transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/>
            <span style={{fontSize:13,color:C.muted}}>{loadMsg||"Working..."}</span>
          </div>
        )}

        {/* ══ PROFILE ══ */}
        {tab==="profile"&&(
          <div>
            <Card glow>
              <Label color={C.accent}>Profile Deep Dive</Label>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:14}}>Paste any TikTok profile URL. Apify pulls all videos automatically — no copying individual links. AI analyzes the raw data cold with zero assumptions.</div>
              <div style={{marginBottom:10}}><TInput placeholder="https://www.tiktok.com/@username or @username" value={profileHandle} onChange={e=>setProfileHandle(e.target.value)}/></div>
              <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Videos to Analyze</div>
              <div style={{display:"flex",gap:7,marginBottom:14}}>
                {[10,20,30].map(n=><button key={n} onClick={()=>setProfileCount(n)} style={{padding:"6px 16px",borderRadius:8,border:`1px solid ${profileCount===n?C.accent:C.border}`,background:profileCount===n?C.accent+"18":"transparent",color:profileCount===n?C.accent:C.muted,fontSize:12,cursor:"pointer",fontWeight:profileCount===n?700:400}}>Last {n}</button>)}
              </div>
              <div style={{fontSize:11,color:C.muted,marginBottom:12}}>{apifySaved?"✓ Apify will pull videos automatically":"⚠ Apify token required for profile analysis"}</div>
              <Btn onClick={runProfile} disabled={loading||!apifySaved||!geminiSaved||!profileHandle} full>Analyze This Profile 👤</Btn>
            </Card>

            {profileResult&&!profileResult.raw&&(()=>{
              const r=profileResult;const s=r.stats;
              return(
                <>
                  <Card>
                    <Label color={C.amber}>Real Channel Stats — Last {r.videoCount} Videos</Label>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
                      <StatPill label="Total Views" value={fmt(s.totalViews)} color={C.accent}/>
                      <StatPill label="Avg Views" value={fmt(s.avgViews)} color={C.blue}/>
                      <StatPill label="Total Likes" value={fmt(s.totalLikes)} color={C.pink}/>
                      <StatPill label="Eng Rate" value={s.avgEngagement?s.avgEngagement+"%":"—"} color={C.green}/>
                    </div>
                    <div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>{r.avgViewsRead}</div>
                  </Card>

                  <Card glow>
                    <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
                      <div style={{width:56,height:56,borderRadius:14,background:`linear-gradient(135deg,${C.accent},#B06FFF)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:900,flexShrink:0,color:"#fff"}}>{r.overallGrade}</div>
                      <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6,flex:1}}>{r.executiveSummary}</div>
                    </div>
                    <Bar label="Channel Health" score={r.channelHealth} color={C.accent}/>
                    <Bar label="Consistency" score={r.consistencyScore} color={C.green}/>
                    <Bar label="Hook Strength (avg)" score={r.hookStrengthAvg} color={C.amber}/>
                    <Bar label="Engagement" score={r.engagementScore} color={C.pink}/>
                    <Bar label="Growth Momentum" score={r.growthMomentum} color="#FF9F47"/>
                  </Card>

                  <Card>
                    <Label color={C.green}>Top 5 Performing Videos</Label>
                    {r.top5.map((v,i)=>(
                      <div key={i} style={{background:C.surface,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
                        <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:6}}>
                          <div style={{minWidth:22,height:22,borderRadius:6,background:C.green+"25",color:C.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>#{i+1}</div>
                          <div style={{fontSize:12,color:"#C8CAE0",lineHeight:1.5,flex:1}}>{v.desc||"No caption"}</div>
                        </div>
                        <div style={{display:"flex",gap:12,paddingLeft:32}}>
                          <span style={{fontSize:11,color:C.accent}}>👁 {fmt(v.playCount)}</span>
                          <span style={{fontSize:11,color:C.pink}}>❤️ {fmt(v.diggCount)}</span>
                          <span style={{fontSize:11,color:C.amber}}>↗️ {fmt(v.shareCount)}</span>
                          <span style={{fontSize:11,color:C.muted}}>{v.video?.duration}s</span>
                        </div>
                      </div>
                    ))}
                  </Card>

                  <Card>
                    <Label color={C.red}>Bottom 5 — Study These</Label>
                    {r.bottom5.map((v,i)=>(
                      <div key={i} style={{background:C.surface,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
                        <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:6}}>
                          <div style={{minWidth:22,height:22,borderRadius:6,background:C.red+"25",color:C.red,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>↓</div>
                          <div style={{fontSize:12,color:"#C8CAE0",lineHeight:1.5,flex:1}}>{v.desc||"No caption"}</div>
                        </div>
                        <div style={{display:"flex",gap:12,paddingLeft:32}}>
                          <span style={{fontSize:11,color:C.accent}}>👁 {fmt(v.playCount)}</span>
                          <span style={{fontSize:11,color:C.pink}}>❤️ {fmt(v.diggCount)}</span>
                          <span style={{fontSize:11,color:C.muted}}>{v.video?.duration}s</span>
                        </div>
                      </div>
                    ))}
                  </Card>

                  <Card>
                    <Label color={C.green}>What's Working</Label>
                    {(r.topPatterns||[]).map((p,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.green}}>✓</span><span style={{fontSize:13,color:"#C8CAE0"}}>{p}</span></div>)}
                    <div style={{height:1,background:C.border,margin:"12px 0"}}/>
                    <Label color={C.red}>What's Flopping</Label>
                    {(r.floppingPatterns||[]).map((p,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.red}}>✕</span><span style={{fontSize:13,color:"#C8CAE0"}}>{p}</span></div>)}
                  </Card>

                  <Card>
                    <Label color={C.accent}>Content Performance</Label>
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Best Content Type</div>
                      <div style={{fontSize:13,color:C.green,fontWeight:700}}>{r.bestContentType}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Worst Content Type</div>
                      <div style={{fontSize:13,color:C.red,fontWeight:700}}>{r.worstContentType}</div>
                    </div>
                  </Card>

                  <Card>
                    <Label color={C.amber}>Hidden Strength</Label>
                    <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:14}}>{r.hiddenStrength}</div>
                    <Label color={C.red}>Biggest Leak</Label>
                    <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.biggestLeak}</div>
                  </Card>

                  <Card>
                    <Label color={C.accent}>Content Gaps</Label>
                    {(r.contentGaps||[]).map((g,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.accent}}>◆</span><span style={{fontSize:13,color:"#C8CAE0"}}>{g}</span></div>)}
                  </Card>

                  <Card glow>
                    <Label color={C.green}>Double Down On This</Label>
                    <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:14,lineHeight:1.6}}>{r.doubleDown}</div>
                    <Label color={C.red}>Drop This Immediately</Label>
                    <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.dropImmediately}</div>
                  </Card>

                  <Card>
                    <Label color={C.amber}>Your Next 30 Days</Label>
                    <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8}}>{r.next30Days}</div>
                  </Card>

                  <Card glow>
                    <Label color={C.accent}>Path to 2M — Based on Your Data</Label>
                    <div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.7,fontStyle:"italic"}}>"{r.pathTo2M}"</div>
                  </Card>
                </>
              );
            })()}
            {profileResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{profileResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ PREDICT ══ */}
        {tab==="predict"&&(
          <div>
            <Card glow>
              <Label color={C.accent}>🎯 Pre-Post Viral Prediction</Label>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:6}}>Upload your video — Gemini watches every frame, quotes your actual words, and tells you exactly what to fix. Then Claude adds the growth strategy on top.</div>
              <div style={{fontSize:11,color:C.green,marginBottom:14}}>⚡ Gemini watches the video · Claude builds the strategy · Most accurate analysis possible</div>
            </Card>
            <Card>
              <Label>Upload Your Video</Label>
              <input ref={predictRef} type="file" accept="video/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f){setPredictFile(f);setPredictPreview(URL.createObjectURL(f));setPredictResult(null);}}}/>
              {!predictPreview?(
                <div onClick={()=>predictRef.current?.click()} style={{border:`2px dashed ${C.border}`,borderRadius:12,padding:"40px 20px",textAlign:"center",cursor:"pointer"}}>
                  <div style={{fontSize:40,marginBottom:10}}>📱</div>
                  <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6}}>Tap to upload your video</div>
                  <div style={{fontSize:12,color:C.muted,marginBottom:4}}>MP4, MOV, HEIC — the video you're about to post</div>
                  <div style={{fontSize:11,color:C.accent}}>Gemini will watch every frame and quote your actual words</div>
                </div>
              ):(
                <div>
                  <video src={predictPreview} controls style={{width:"100%",borderRadius:10,marginBottom:10,maxHeight:300}}/>
                  <div style={{display:"flex",gap:8}}>
                    <Btn onClick={()=>{setPredictFile(null);setPredictPreview("");setPredictResult(null);}} color={C.red}>Remove</Btn>
                    <Btn onClick={()=>predictRef.current?.click()} color={C.dim}>Change</Btn>
                  </div>
                </div>
              )}
            </Card>
            {predictPreview&&<div style={{marginBottom:14}}><Btn onClick={runPredict} disabled={loading||!geminiSaved||!predictFile} full color={C.accent}>{loading?loadMsg||"Analyzing...":"Analyze My Video — Gemini + Claude 🎯"}</Btn></div>}

            {predictResult&&!predictResult.raw&&(()=>{
              const r=predictResult;
              const vc=r.verdict&&r.verdict.includes("POST IT")?C.green:r.verdict&&r.verdict.includes("NEEDS")?C.amber:C.red;
              return(
                <>
                  {/* Verdict */}
                  <Card glow style={{borderColor:vc+"60"}}>
                    <div style={{textAlign:"center",marginBottom:16}}>
                      <div style={{fontSize:24,fontWeight:900,color:vc,marginBottom:4}}>{r.verdict}</div>
                      <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:4}}>{r.viralProbability}</div>
                      <div style={{fontSize:12,color:C.muted}}>Predicted: <span style={{color:C.text,fontWeight:700}}>{r.predictedViews} views</span> · Grade: <span style={{color:vc,fontWeight:800,fontSize:15}}>{r.algorithmGrade}</span> · Confidence: <span style={{color:C.accent,fontWeight:700}}>{r.confidenceScore}</span></div>
                    </div>
                    <Bar label="Overall Viral Score" score={r.overallViralScore} color={vc}/>
                    <Bar label="Hook" score={r.hookScore} color={C.green}/>
                    <Bar label="Retention" score={r.retentionScore} color={C.amber}/>
                    <Bar label="Shareability" score={r.shareabilityScore} color={C.pink}/>
                    <Bar label="Emotional Pull" score={r.emotionScore} color="#FF9F47"/>
                    <Bar label="Loop Potential" score={r.loopScore} color={C.blue}/>
                    <Bar label="Comment Bait" score={r.commentBaitScore} color={C.pink}/>
                  </Card>

                  {/* Gemini's actual observations */}
                  {r.exactOpeningLine&&(
                    <Card>
                      <Label color={C.green}>What Gemini Actually Heard</Label>
                      <div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Your Opening Line</div>
                      <div style={{fontSize:15,fontWeight:800,color:C.text,background:C.surface,borderRadius:8,padding:"12px 14px",marginBottom:12,fontStyle:"italic"}}>"{r.exactOpeningLine}"</div>
                      <div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Hook (First 3 Seconds)</div>
                      <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.exactHook}</div>
                    </Card>
                  )}

                  {/* Hook Autopsy */}
                  <Card>
                    <Label color={r.hookScore>=7?C.green:r.hookScore>=5?C.amber:C.red}>Hook Analysis</Label>
                    <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:10}}>{r.hookAnalysis}</div>
                    {r.hookScore_reasoning&&<div style={{fontSize:12,color:C.muted,lineHeight:1.6,fontStyle:"italic"}}>{r.hookScore_reasoning}</div>}
                  </Card>

                  {/* Script Analysis */}
                  {r.scriptAnalysis&&(
                    <Card>
                      <Label color={C.accent}>Script Deep Dive</Label>
                      {r.scriptAnalysis.peakMoment&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:C.green,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:3}}>Best Moment</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.5}}>"{r.scriptAnalysis.peakMoment}"</div></div>}
                      {r.scriptAnalysis.weakMoment&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:C.red,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:3}}>Weakest Moment</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.5}}>"{r.scriptAnalysis.weakMoment}"</div></div>}
                      {r.scriptAnalysis.shareableLine&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:C.amber,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:3}}>Most Shareable Line</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.5}}>"{r.scriptAnalysis.shareableLine}"</div></div>}
                      {r.scriptAnalysis.pacing&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:3}}>Pacing</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.5}}>{r.scriptAnalysis.pacing}</div></div>}
                      {r.scriptAnalysis.narrativeArc&&<div><div style={{fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:3}}>Narrative Arc</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.5}}>{r.scriptAnalysis.narrativeArc}</div></div>}
                    </Card>
                  )}

                  {/* Viewer Psychology */}
                  {r.viewerPsychology&&(
                    <Card>
                      <Label color={C.green}>Viewer Psychology</Label>
                      {Object.entries(r.viewerPsychology).map(([key,val])=>(
                        <div key={key} style={{background:C.surface,borderRadius:8,padding:"10px 12px",marginBottom:8}}>
                          <div style={{fontSize:10,color:C.green,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>{key.replace(/([A-Z])/g," $1").trim()}</div>
                          <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.5}}>{val}</div>
                        </div>
                      ))}
                    </Card>
                  )}

                  {/* Visual + Audio */}
                  {(r.visualAnalysis||r.audioAnalysis)&&(
                    <Card>
                      {r.visualAnalysis&&<><Label color={C.amber}>Visual Analysis</Label>
                        {Object.entries(r.visualAnalysis).map(([k,v])=><div key={k} style={{marginBottom:8}}><div style={{fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:2}}>{k.replace(/([A-Z])/g," $1").trim()}</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.5}}>{v}</div></div>)}
                      </>}
                      {r.audioAnalysis&&<><div style={{height:1,background:C.border,margin:"12px 0"}}/><Label color={C.blue}>Audio Analysis</Label>
                        {Object.entries(r.audioAnalysis).map(([k,v])=><div key={k} style={{marginBottom:8}}><div style={{fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:2}}>{k}</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.5}}>{v}</div></div>)}
                      </>}
                    </Card>
                  )}

                  {/* Algorithm Signals */}
                  {r.algorithmSignals&&(
                    <Card>
                      <Label color={C.accent}>Algorithm Signals</Label>
                      {Object.entries(r.algorithmSignals).map(([k,v])=>(
                        <div key={k} style={{display:"flex",gap:10,marginBottom:9}}>
                          <span style={{color:C.accent,flexShrink:0}}>◆</span>
                          <div><span style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>{k.replace(/([A-Z])/g," $1").trim()}: </span><span style={{fontSize:13,color:"#C8CAE0"}}>{v}</span></div>
                        </div>
                      ))}
                    </Card>
                  )}

                  {/* Retention */}
                  <Card>
                    <Label color={C.red}>Retention Killers</Label>
                    {(r.retentionKillers||[]).map((k,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.red}}>✕</span><span style={{fontSize:13,color:"#C8CAE0"}}>{k}</span></div>)}
                    <div style={{height:1,background:C.border,margin:"12px 0"}}/>
                    <Label color={C.green}>Retention Boosts</Label>
                    {(r.retentionBoosts||[]).map((b,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.green}}>✓</span><span style={{fontSize:13,color:"#C8CAE0"}}>{b}</span></div>)}
                  </Card>

                  {/* Fixes */}
                  <Card style={{borderColor:C.amber+"50"}}>
                    <Label color={C.amber}>Fix Before Posting</Label>
                    {(r.fixBeforePosting||[]).map((f,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.amber,fontWeight:800}}>{i+1}.</span><span style={{fontSize:13,color:"#C8CAE0"}}>{f}</span></div>)}
                  </Card>

                  {/* Rewritten hook */}
                  <Card glow>
                    <Label color={C.green}>Rewritten Hook — 3x Stronger</Label>
                    <div style={{fontSize:16,fontWeight:800,color:C.text,background:C.surface,borderRadius:8,padding:"14px 16px",marginBottom:14,fontStyle:"italic"}}>"{r.rewrittenHook}"</div>
                    <Label color={C.pink}>Optimized Caption</Label>
                    <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8,background:C.surface,borderRadius:8,padding:"12px 14px",marginBottom:14}}>{r.rewrittenCaption}</div>
                    <Label color={C.blue}>Best Time to Post</Label>
                    <div style={{fontSize:13,fontWeight:700,color:C.text}}>{r.bestTimeToPost}</div>
                  </Card>

                  {/* Viral version */}
                  <Card>
                    <Label color={C.accent}>How to Reshoot for 1M Views</Label>
                    <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8}}>{r.viralVersion}</div>
                  </Card>

                  {/* Claude strategy layer */}
                  {r.strategyNote&&(
                    <Card glow>
                      <Label color={C.accent}>Growth Strategy (Claude)</Label>
                      <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:14}}>{r.strategyNote}</div>
                      {r.nextThreeVideos&&<><Label color={C.green}>Make These Next</Label>
                        {r.nextThreeVideos.map((v,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.green,fontWeight:800}}>{i+1}.</span><span style={{fontSize:13,color:"#C8CAE0"}}>{v}</span></div>)}
                      </>}
                      {r.algorithmPlay&&<><div style={{height:1,background:C.border,margin:"12px 0"}}/><Label color={C.amber}>Algorithm Play You're Missing</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.algorithmPlay}</div></>}
                      {r.growthTrajectory&&<><div style={{height:1,background:C.border,margin:"12px 0"}}/><Label color={C.blue}>Growth Trajectory</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.growthTrajectory}</div></>}
                    </Card>
                  )}

                  {/* Competitor angle */}
                  {r.competitorAngle&&<Card><Label color={C.pink}>How a Top Creator Would Do This</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.competitorAngle}</div></Card>}
                </>
              );
            })()}
            {predictResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{predictResult.raw}</div></Card>}
          </div>
        )}

        {tab==="competitor"&&(
          <div>
            <Card>
              <Label>Drop a Specific TikTok Video URL</Label>
              <div style={{marginBottom:8}}><TInput placeholder="https://www.tiktok.com/@username/video/1234567890..." value={compUrl} onChange={e=>setCompUrl(e.target.value)}/></div>
              <div style={{fontSize:11,color:C.muted,marginBottom:10}}>Must be a specific video URL not a profile. {apifySaved?"✓ Live stats enabled":"⚠ Add Apify for live engagement data"}</div>
              <Btn onClick={runCompetitor} disabled={loading||!compUrl||!geminiSaved} full>Reverse Engineer This Video ⚡</Btn>
            </Card>
            {compResult&&!compResult.raw&&(()=>{
              const r=compResult;
              return(
                <>
                  {r.engagement&&(
                    <Card>
                      <Label color={C.amber}>Live Engagement Data</Label>
                      <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6,marginBottom:12,background:C.surface,borderRadius:8,padding:"10px 12px"}}>{r.engagement.desc||"No caption"}</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
                        <StatPill label="Views" value={fmt(r.engagement.playCount)} color={C.accent}/>
                        <StatPill label="Likes" value={fmt(r.engagement.diggCount)} color={C.pink}/>
                        <StatPill label="Comments" value={fmt(r.engagement.commentCount)} color={C.green}/>
                        <StatPill label="Shares" value={fmt(r.engagement.shareCount)} color={C.amber}/>
                      </div>
                      {r.performanceSummary&&<div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>{r.performanceSummary}</div>}
                    </Card>
                  )}
                  <Card glow>
                    <div style={{fontSize:16,fontWeight:900,marginBottom:8}}>{r.title}</div>
                    <div style={{marginBottom:14}}>{(r.tags||[]).map(t=><Chip key={t}>{t}</Chip>)}</div>
                    <Bar label="Viral Score" score={r.viralScore} color={C.accent}/>
                    <Bar label="Hook" score={r.hookScore} color={C.green}/>
                    <Bar label="Retention" score={r.retentionScore} color={C.amber}/>
                    <Bar label="Shareability" score={r.shareabilityScore} color={C.pink}/>
                    <Bar label="Emotional Pull" score={r.emotionScore} color="#FF9F47"/>
                  </Card>
                  <Card><Label color={C.green}>Hook Breakdown</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.hookBreakdown}</div></Card>
                  <Card><Label>Video Structure</Label>{(r.structure||[]).map((b,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}><div style={{minWidth:22,height:22,borderRadius:6,background:C.accent+"25",color:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0,marginTop:1}}>{i+1}</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{b}</div></div>)}</Card>
                  <Card><Label color={C.green}>Why It Works</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:10}}>{r.whyItWorks}</div><Chip color={C.green}>{r.emotionalDriver}</Chip></Card>
                  <Card>
                    <Label color={C.amber}>Steal These</Label>
                    {(r.steal||[]).map((s,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.green}}>→</span><span style={{fontSize:13,color:"#C8CAE0"}}>{s}</span></div>)}
                    {(r.avoid||[]).length>0&&<><div style={{height:1,background:C.border,margin:"12px 0"}}/><Label color={C.red}>Skip These</Label>{r.avoid.map((s,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.red}}>✕</span><span style={{fontSize:13,color:"#C8CAE0"}}>{s}</span></div>)}</>}
                  </Card>
                  <Card glow><Label>The Formula</Label><div style={{fontSize:14,color:C.text,fontWeight:700,fontStyle:"italic",lineHeight:1.6}}>"{r.formula}"</div></Card>
                </>
              );
            })()}
            {compResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{compResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ SCRIPT ══ */}
        {tab==="script"&&(
          <div>
            <Card>
              <Label>What's the video about?</Label>
              <div style={{marginBottom:12}}><TInput placeholder="e.g. The reality of having a gay son..." value={scriptTopic} onChange={e=>setScriptTopic(e.target.value)}/></div>
              <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Content Angle</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
                {ANGLES.map(a=><button key={a.id} onClick={()=>setScriptAngle(a.id)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${scriptAngle===a.id?C.accent:C.border}`,background:scriptAngle===a.id?C.accent+"18":"transparent",color:scriptAngle===a.id?C.accent:C.muted,fontSize:12,cursor:"pointer",fontWeight:scriptAngle===a.id?700:400}}>{a.label}</button>)}
              </div>
              <Btn onClick={runScript} disabled={loading||!scriptTopic||!geminiSaved} full>Generate Script ✍️</Btn>
            </Card>
            {scriptResult&&!scriptResult.raw&&(()=>{
              const r=scriptResult;
              return(
                <>
                  <Card glow>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{fontSize:16,fontWeight:900,flex:1,marginRight:12}}>{r.title}</div>
                      <div style={{fontSize:26,fontWeight:900,color:C.accent,lineHeight:1}}>{r.viralPotential}<span style={{fontSize:12,color:C.muted,fontWeight:400}}>/10</span></div>
                    </div>
                    <div style={{fontSize:12,color:C.muted,marginTop:8,lineHeight:1.6}}>{r.whyItWillWork}</div>
                  </Card>
                  <Card><Label color={C.green}>Opening Hook</Label><div style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:6}}>"{r.hook}"</div><div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>{r.whyThisHook}</div></Card>
                  <Card>
                    <Label>Shot-by-Shot Script</Label>
                    {(r.script||[]).map((beat,i)=>{
                      const bc=[C.green,C.accent,C.amber,C.pink,C.accent][i%5];
                      return(
                        <div key={i} style={{background:C.surface,borderRadius:10,padding:"12px 14px",marginBottom:10,borderLeft:`3px solid ${i===0?C.green:i===r.script.length-1?C.accent:C.border}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><Chip color={bc}>{beat.beat}</Chip><span style={{fontSize:10,color:C.muted}}>{beat.duration}</span></div>
                          {beat.action&&<div style={{fontSize:11,color:C.muted,marginBottom:5}}>📹 {beat.action}</div>}
                          {beat.dialogue&&<div style={{fontSize:13,color:C.text,fontStyle:"italic"}}>"{beat.dialogue}"</div>}
                        </div>
                      );
                    })}
                  </Card>
                  <Card><Label color={C.amber}>Visual Direction</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:14}}>{r.visualDirection}</div><Label color={C.amber}>Sound Strategy</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.soundStrategy}</div></Card>
                  <Card><Label color={C.pink}>Ready-to-Post Caption</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8,background:C.surface,borderRadius:8,padding:"12px 14px"}}>{r.caption}</div></Card>
                </>
              );
            })()}
            {scriptResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{scriptResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ ANALYZE ME ══ */}
        {tab==="analyze"&&(
          <div>
            <Card>
              <Label>Analyze a specific video</Label>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                {[{id:"url",label:"TikTok URL"},{id:"manual",label:"Describe It"}].map(m=><button key={m.id} onClick={()=>setMyMode(m.id)} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${myMode===m.id?C.accent:C.border}`,background:myMode===m.id?C.accent+"18":"transparent",color:myMode===m.id?C.accent:C.muted,fontSize:12,cursor:"pointer",fontWeight:myMode===m.id?700:400}}>{m.label}</button>)}
              </div>
              {myMode==="url"?<div style={{marginBottom:12}}><TInput placeholder="https://www.tiktok.com/@username/video/..." value={myUrl} onChange={e=>setMyUrl(e.target.value)}/></div>:<div style={{marginBottom:12}}><TInput placeholder="Describe your video — what happened, hook, how it performed, what felt off..." value={myText} onChange={e=>setMyText(e.target.value)} rows={4}/></div>}
              <div style={{fontSize:11,color:C.muted,marginBottom:10}}>{apifySaved?"✓ Will pull real engagement stats":"⚠ Add Apify for real stats"}</div>
              <Btn onClick={runAnalyzeMe} disabled={loading||!geminiSaved||(myMode==="url"?!myUrl:!myText)} full>Analyze This Video 🔬</Btn>
            </Card>
            {myResult&&!myResult.raw&&(()=>{
              const r=myResult;
              return(
                <>
                  {r.engagement&&(
                    <Card>
                      <Label color={C.amber}>Your Video Stats</Label>
                      <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6,marginBottom:12,background:C.surface,borderRadius:8,padding:"10px 12px"}}>{r.engagement.desc||"No caption"}</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:r.numbersRead?12:0}}>
                        <StatPill label="Views" value={fmt(r.engagement.playCount)} color={C.accent}/>
                        <StatPill label="Likes" value={fmt(r.engagement.diggCount)} color={C.pink}/>
                        <StatPill label="Comments" value={fmt(r.engagement.commentCount)} color={C.green}/>
                        <StatPill label="Shares" value={fmt(r.engagement.shareCount)} color={C.amber}/>
                      </div>
                      {r.numbersRead&&<div style={{fontSize:12,color:C.muted,marginTop:10,lineHeight:1.6}}>{r.numbersRead}</div>}
                    </Card>
                  )}
                  <Card glow><Label>Performance Breakdown</Label><Bar label="Overall" score={r.overallScore} color={C.accent}/><Bar label="Hook" score={r.hookScore} color={C.green}/><Bar label="Retention" score={r.retentionScore} color={C.amber}/><Bar label="Brand" score={r.brandScore} color={C.pink}/><Bar label="Growth Potential" score={r.growthScore} color="#FF9F47"/></Card>
                  <Card><Label color={C.green}>What Worked</Label>{(r.whatWorked||[]).map((w,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.green}}>✓</span><span style={{fontSize:13,color:"#C8CAE0"}}>{w}</span></div>)}</Card>
                  <Card><Label color={C.red}>What Missed</Label>{(r.whatMissed||[]).map((w,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.red}}>✕</span><span style={{fontSize:13,color:"#C8CAE0"}}>{w}</span></div>)}</Card>
                  <Card><Label color={C.amber}>The Breakthrough Move</Label><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.6}}>{r.breakthroughMove}</div></Card>
                  <Card><Label>Pattern Insight</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:14}}>{r.patternInsight}</div><Label color={C.green}>Make This Next</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.nextVideo}</div></Card>
                  <Card glow><Label color={C.accent}>Direct Note</Label><div style={{fontSize:14,color:C.text,lineHeight:1.8,fontStyle:"italic"}}>"{r.directNote}"</div></Card>
                </>
              );
            })()}
            {myResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{myResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ STRATEGY ══ */}
        {tab==="strategy"&&(
          <div>
            <Card glow>
              <Label color={C.accent}>Data-Driven Growth Strategy</Label>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:14}}>{profileResult?"Strategy built from your real profile data.":"Run Profile Analysis first for data-driven strategy. Or get a general strategy now."}</div>
              <Btn onClick={runStrategy} disabled={loading||!geminiSaved} full>Build My Strategy 🧭</Btn>
            </Card>
            {strategyResult&&!strategyResult.raw&&(()=>{
              const r=strategyResult;
              return(
                <>
                  <Card glow><Label color={C.accent}>Core Identity</Label><div style={{fontSize:15,fontWeight:700,color:C.text,lineHeight:1.6,marginBottom:14}}>{r.coreIdentity}</div><Label color={C.green}>Biggest Untapped Asset</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.biggestAsset}</div></Card>
                  <Card>
                    <Label>Niche Opportunities</Label>
                    {(r.niches||[]).map((n,i)=>(
                      <div key={i} style={{background:C.surface,borderRadius:12,padding:"14px 16px",marginBottom:12,borderLeft:`3px solid ${[C.accent,C.green,C.amber,C.pink][i%4]}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                          <div style={{fontSize:14,fontWeight:800,color:C.text}}>{n.name}</div>
                          <Chip color={n.difficulty==="Easy"?C.green:n.difficulty==="Medium"?C.amber:C.red}>{n.difficulty}</Chip>
                        </div>
                        <div style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:4}}><span style={{color:C.accent}}>Why you: </span>{n.why}</div>
                        <div style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:4}}><span style={{color:C.green}}>Your angle: </span>{n.howToWin}</div>
                        <div style={{fontSize:12,color:C.muted,lineHeight:1.6}}><span style={{color:C.amber}}>Why now: </span>{n.urgency}</div>
                      </div>
                    ))}
                  </Card>
                  <Card glow><Label color={C.green}>Top Recommendation</Label><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.6}}>{r.topNiche}</div></Card>
                  <Card><Label color={C.amber}>Revenue Angles</Label>{(r.revenueAngles||[]).map((a,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.pink}}>💰</span><span style={{fontSize:13,color:"#C8CAE0"}}>{a}</span></div>)}</Card>
                  <Card><Label>Milestone Roadmap</Label>{(r.milestoneRoadmap||[]).map((m,i)=>(<div key={i} style={{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}}><div style={{minWidth:60,padding:"3px 8px",borderRadius:6,background:[C.accent,C.green,C.amber][i]+"25",color:[C.accent,C.green,C.amber][i],fontSize:10,fontWeight:800,textAlign:"center",flexShrink:0}}>{["1M","2M","5M"][i]}</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6,paddingTop:2}}>{m}</div></div>))}</Card>
                  <Card style={{borderColor:C.red+"50"}}><Label color={C.red}>Hard Truth</Label><div style={{fontSize:14,color:C.text,fontWeight:600,lineHeight:1.7,fontStyle:"italic"}}>"{r.hardTruth}"</div></Card>
                </>
              );
            })()}
            {strategyResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{strategyResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ BRAND ID ══ */}
        {tab==="brand"&&(
          <div>
            <Card glow>
              <Label color={C.accent}>Brand Identity Engine</Label>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:14}}>{profileResult?"Brand analysis built from your actual content data.":"Run Profile Analysis first for data-driven brand identity."}</div>
              <Btn onClick={runBrand} disabled={loading||!geminiSaved} full>Define My Brand ⭐</Btn>
            </Card>
            {brandResult&&!brandResult.raw&&(()=>{
              const r=brandResult;
              return(
                <>
                  <Card glow><Label color={C.accent}>Brand Statement</Label><div style={{fontSize:16,fontWeight:800,color:C.text,lineHeight:1.5,marginBottom:14}}>{r.brandStatement}</div><Label color={C.green}>Tagline</Label><div style={{fontSize:22,fontWeight:900,color:C.green,letterSpacing:"-0.02em"}}>{r.tagline}</div></Card>
                  <Card><Label>Core Values</Label>{(r.coreValues||[]).map((v,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:10}}><span style={{color:C.accent,flexShrink:0}}>◆</span><span style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{v}</span></div>)}</Card>
                  <Card>
                    <Label color={C.blue}>Your Audience</Label>
                    <div style={{marginBottom:10}}><div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Right Now</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.audience?.primary}</div></div>
                    <div style={{marginBottom:10}}><div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Speak to Next</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.audience?.aspirational}</div></div>
                    <div><div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Their Mindset</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.audience?.psychographic}</div></div>
                  </Card>
                  <Card>
                    <Label>Content Pillars</Label>
                    {(r.contentPillars||[]).map((p,i)=>{
                      const c=[C.accent,C.green,C.amber,C.pink][i%4];
                      return(<div key={i} style={{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}}><div style={{minWidth:44,padding:"3px 6px",borderRadius:6,background:c+"25",color:c,fontSize:10,fontWeight:800,textAlign:"center",flexShrink:0}}>{p.percentage}</div><div><div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:3}}>{p.pillar}</div><div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>{p.description}</div></div></div>);
                    })}
                  </Card>
                  <Card glow><Label color={C.green}>What Makes You Different</Label><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.6,marginBottom:14}}>{r.whatMakesYouDifferent}</div><Label color={C.red}>Stop Doing This</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.whatToStop}</div></Card>
                  <Card glow><Label color={C.accent}>Your North Star at 5M</Label><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.7,fontStyle:"italic"}}>"{r.northStar}"</div></Card>
                </>
              );
            })()}
            {brandResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{brandResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ CALENDAR ══ */}
        {tab==="calendar"&&(
          <div>
            <Card>
              <Label>7-Day Content Calendar</Label>
              <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Weekly Focus</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
                {[{id:"mixed",label:"Balanced"},{id:"mother-son",label:"Mother-Son 🤝"},{id:"travel",label:"Travel ✈️"},{id:"growth",label:"Max Growth 📈"},{id:"brand",label:"Brand Deals 💰"}].map(f=><button key={f.id} onClick={()=>setCalFocus(f.id)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${calFocus===f.id?C.accent:C.border}`,background:calFocus===f.id?C.accent+"18":"transparent",color:calFocus===f.id?C.accent:C.muted,fontSize:12,cursor:"pointer",fontWeight:calFocus===f.id?700:400}}>{f.label}</button>)}
              </div>
              <Btn onClick={runCalendar} disabled={loading||!geminiSaved} full>Generate My Week 📅</Btn>
            </Card>
            {calResult&&!calResult.raw&&(()=>{
              const r=calResult;
              return(
                <>
                  <Card glow><Label color={C.accent}>This Week's Theme</Label><div style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:10}}>{r.weekTheme}</div><Label color={C.green}>Hero Video</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.heroVideo}</div></Card>
                  {(r.days||[]).map((d,i)=>{
                    const c=[C.accent,C.green,C.amber,C.pink,C.blue,C.accent,C.green][i];
                    return(
                      <div key={i} style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,padding:"16px",marginBottom:12}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                          <div style={{fontSize:13,fontWeight:800,color:c}}>{d.day}</div>
                          <div style={{display:"flex",gap:6}}><Chip color={effortColor(d.effort)}>{d.effort}</Chip><span style={{fontSize:11,color:C.muted}}>{d.viralPotential}/10 🔥</span></div>
                        </div>
                        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>{d.concept}</div>
                        <div style={{fontSize:12,color:C.muted,marginBottom:6,fontStyle:"italic"}}>Hook: "{d.hook}"</div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><Chip color={c}>{d.angle}</Chip><span style={{fontSize:11,color:C.dim}}>{d.notes}</span></div>
                      </div>
                    );
                  })}
                  <Card><Label color={C.amber}>Repurpose Tip</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.repurposeTip}</div></Card>
                </>
              );
            })()}
            {calResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{calResult.raw}</div></Card>}
          </div>
        )}


        {/* ══ DEEP DIVE ══ */}
        {tab==="deepdive"&&(
          <div>
            <Card glow>
              <Label color={C.accent}>🧠 Algorithm Deep Dive</Label>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:6}}>This is the game-changer. Paste any TikTok URL — yours or a competitor's. The AI thinks like both the TikTok algorithm AND a real viewer to give you a second-by-second breakdown, viral probability score, and exact fixes.</div>
              <div style={{fontSize:11,color:C.green,marginBottom:14}}>Based on real TikTok algorithm signals: completion rate, rewatch rate, share ratio, comment triggers, save signals.</div>
            </Card>
            <Card>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                {[{id:"url",label:"TikTok URL"},{id:"manual",label:"Describe It"}].map(m=><button key={m.id} onClick={()=>setDeepMode(m.id)} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${deepMode===m.id?C.accent:C.border}`,background:deepMode===m.id?C.accent+"18":"transparent",color:deepMode===m.id?C.accent:C.muted,fontSize:12,cursor:"pointer",fontWeight:deepMode===m.id?700:400}}>{m.label}</button>)}
              </div>
              {deepMode==="url"?<div style={{marginBottom:12}}><TInput placeholder="https://www.tiktok.com/@username/video/..." value={deepUrl} onChange={e=>setDeepUrl(e.target.value)}/></div>:<div style={{marginBottom:12}}><TInput placeholder="Describe the video in detail: what you said, how you opened, what happened, how it ended, the vibe..." value={deepText} onChange={e=>setDeepText(e.target.value)} rows={5}/></div>}
              <div style={{fontSize:11,color:C.muted,marginBottom:10}}>{apifySaved?"✓ Will pull real engagement data for algorithm analysis":"⚠ Add Apify for real stats — makes analysis 10x more accurate"}</div>
              <Btn onClick={runDeepDive} disabled={loading||!geminiSaved||(deepMode==="url"?!deepUrl:!deepText)} full color={C.accent}>Run Algorithm Deep Dive 🧠</Btn>
            </Card>

            {deepResult&&!deepResult.raw&&(()=>{
              const r=deepResult;
              const verdictColor=r.verdict&&r.verdict.includes("POST NOW")?C.green:r.verdict&&r.verdict.includes("RESHOOT")?C.amber:C.red;
              return(
                <>
                  {/* Verdict */}
                  <Card glow style={{borderColor:verdictColor+"60"}}>
                    <div style={{textAlign:"center",marginBottom:16}}>
                      <div style={{fontSize:22,fontWeight:900,color:verdictColor,marginBottom:6}}>{r.verdict}</div>
                      <div style={{fontSize:20,fontWeight:900,color:C.text,marginBottom:4}}>{r.viralProbability}</div>
                      <div style={{fontSize:12,color:C.muted}}>Algorithm Grade: <span style={{color:verdictColor,fontWeight:800,fontSize:16}}>{r.algorithmGrade}</span> · Confidence: <span style={{color:C.accent,fontWeight:700}}>{r.confidenceScore}</span></div>
                    </div>
                    <Bar label="Algorithm Score" score={r.algorithmScore} color={C.accent}/>
                    <Bar label="Viewer Score" score={r.viewerScore} color={C.green}/>
                    <Bar label="Hook" score={r.hookScore} color={C.amber}/>
                    <Bar label="Retention" score={r.retentionScore} color={C.pink}/>
                    <Bar label="Shareability" score={r.shareabilityScore} color="#FF9F47"/>
                    <Bar label="Loop Potential" score={r.loopScore} color={C.blue}/>
                    <Bar label="Comment Bait" score={r.commentBaitScore} color={C.pink}/>
                  </Card>

                  {/* Real stats */}
                  {r.engagement&&(
                    <Card>
                      <Label color={C.amber}>Real Performance Data</Label>
                      <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6,marginBottom:12,background:C.surface,borderRadius:8,padding:"10px 12px"}}>{r.engagement.desc||"No caption"}</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                        <StatPill label="Views" value={fmt(r.engagement.playCount)} color={C.accent}/>
                        <StatPill label="Likes" value={fmt(r.engagement.diggCount)} color={C.pink}/>
                        <StatPill label="Comments" value={fmt(r.engagement.commentCount)} color={C.green}/>
                        <StatPill label="Shares" value={fmt(r.engagement.shareCount)} color={C.amber}/>
                      </div>
                    </Card>
                  )}

                  {/* Algorithm Report */}
                  <Card>
                    <Label color={C.accent}>Algorithm Report Card</Label>
                    {r.algorithmReport&&Object.entries(r.algorithmReport).map(([key,val])=>(
                      <div key={key} style={{marginBottom:10}}>
                        <div style={{fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:3}}>{key.replace(/([A-Z])/g," $1").trim()}</div>
                        <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.5}}>{val}</div>
                      </div>
                    ))}
                  </Card>

                  {/* Viewer Psychology */}
                  <Card>
                    <Label color={C.green}>Viewer Psychology Breakdown</Label>
                    {r.viewerPsychology&&Object.entries(r.viewerPsychology).map(([key,val])=>(
                      <div key={key} style={{background:C.surface,borderRadius:8,padding:"10px 12px",marginBottom:8}}>
                        <div style={{fontSize:10,color:C.green,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>{key.replace(/([A-Z])/g," $1").trim()}</div>
                        <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.5,fontStyle:"italic"}}>"{val}"</div>
                      </div>
                    ))}
                  </Card>

                  {/* Second by second */}
                  <Card>
                    <Label color={C.amber}>Second-by-Second Breakdown</Label>
                    {(r.secondBySecond||[]).map((s,i)=>(
                      <div key={i} style={{background:C.surface,borderRadius:10,padding:"12px 14px",marginBottom:10,borderLeft:`3px solid ${[C.green,C.accent,C.amber,C.pink][i%4]}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                          <Chip color={[C.green,C.accent,C.amber,C.pink][i%4]}>{s.timestamp}</Chip>
                        </div>
                        <div style={{fontSize:12,color:C.muted,marginBottom:4}}>📹 {s.what}</div>
                        <div style={{fontSize:12,color:C.green,marginBottom:4}}>👁 Viewer: "{s.viewerReaction}"</div>
                        <div style={{fontSize:12,color:C.accent}}>⚡ Algorithm: {s.algorithmSignal}</div>
                      </div>
                    ))}
                  </Card>

                  {/* Hook Autopsy */}
                  <Card>
                    <Label color={C.red}>Hook Autopsy</Label>
                    <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:14}}>{r.hookAutopsy}</div>
                    <Label color={C.green}>Rewritten Hook</Label>
                    <div style={{fontSize:15,fontWeight:800,color:C.text,background:C.surface,borderRadius:8,padding:"12px 14px"}}>"{r.rewrittenHook}"</div>
                  </Card>

                  {/* Retention */}
                  <Card>
                    <Label color={C.red}>Retention Killers</Label>
                    {(r.retentionKillers||[]).map((k,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.red}}>✕</span><span style={{fontSize:13,color:"#C8CAE0"}}>{k}</span></div>)}
                    <div style={{height:1,background:C.border,margin:"12px 0"}}/>
                    <Label color={C.green}>Retention Boosts</Label>
                    {(r.retentionBoosts||[]).map((b,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.green}}>✓</span><span style={{fontSize:13,color:"#C8CAE0"}}>{b}</span></div>)}
                  </Card>

                  {/* Algorithm Fixes */}
                  <Card style={{borderColor:C.amber+"50"}}>
                    <Label color={C.amber}>Algorithm Fixes — Do These</Label>
                    {(r.algorithmFixes||[]).map((f,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.amber,fontWeight:800}}>{i+1}.</span><span style={{fontSize:13,color:"#C8CAE0"}}>{f}</span></div>)}
                  </Card>

                  {/* Viral version */}
                  <Card glow>
                    <Label color={C.accent}>How to Reshoot This to Hit 1M Views</Label>
                    <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8,marginBottom:14}}>{r.viralVersion}</div>
                    <Label color={C.blue}>Rewritten Caption</Label>
                    <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8,background:C.surface,borderRadius:8,padding:"12px 14px",marginBottom:14}}>{r.rewrittenCaption}</div>
                    <Label color={C.green}>Optimal Post Time</Label>
                    <div style={{fontSize:13,fontWeight:700,color:C.text}}>{r.optimalPostTime}</div>
                  </Card>

                  <Card>
                    <Label color={C.pink}>How a Top Creator Would Do This</Label>
                    <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.competitorAngle}</div>
                  </Card>
                </>
              );
            })()}
            {deepResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{deepResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ UNBLOCK ══ */}
        {tab==="unblock"&&(
          <div>
            <Card glow>
              <Label color={C.accent}>Creative Unblock</Label>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:14}}>Tell me what you're feeling — or leave it blank. No judgment. Just clarity and ideas.</div>
              <div style={{marginBottom:12}}><TInput placeholder="e.g. I don't know what to post, everything feels the same, I'm scared my next video flops..." value={blockFeeling} onChange={e=>setBlockFeeling(e.target.value)} rows={3}/></div>
              <Btn onClick={runUnblock} disabled={loading||!geminiSaved} full color={C.pink}>Break Through My Block 💡</Btn>
            </Card>
            {unblockResult&&!unblockResult.raw&&(()=>{
              const r=unblockResult;
              return(
                <>
                  <Card glow style={{borderColor:C.pink+"50"}}><Label color={C.pink}>What Your Block Is Actually Telling You</Label><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.7,marginBottom:14}}>{r.reframe}</div><Label color={C.muted}>Root Cause</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.rootCause}</div></Card>
                  <Card glow style={{borderColor:C.green+"50"}}><Label color={C.green}>Do This Today</Label><div style={{fontSize:15,fontWeight:700,color:C.text,lineHeight:1.6}}>{r.immediateAction}</div></Card>
                  <Card>
                    <Label color={C.accent}>6 Ideas Ready to Film Right Now</Label>
                    {(r.ideas||[]).map((idea,i)=>{
                      const c=[C.accent,C.green,C.amber,C.pink,C.blue,C.accent][i];
                      return(
                        <div key={i} style={{background:C.surface,borderRadius:12,padding:"14px 16px",marginBottom:10,borderLeft:`3px solid ${c}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                            <div style={{fontSize:14,fontWeight:700,color:C.text,flex:1,marginRight:10}}>{idea.title}</div>
                            <div style={{display:"flex",gap:5,flexShrink:0}}><Chip color={effortColor(idea.effort)}>{idea.effort}</Chip><span style={{fontSize:10,color:C.muted,paddingTop:3}}>{idea.viralPotential}/10</span></div>
                          </div>
                          <div style={{fontSize:12,color:C.muted,fontStyle:"italic",marginBottom:5}}>"{idea.hook}"</div>
                          <div style={{fontSize:11,color:c}}>{idea.whyNow}</div>
                        </div>
                      );
                    })}
                  </Card>
                  <Card><Label color={C.amber}>Mindset Shift</Label><div style={{fontSize:14,fontWeight:600,color:C.text,lineHeight:1.7,marginBottom:14}}>{r.mindsetShift}</div><Label color={C.green}>Remember This</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.reminder}</div></Card>
                  <Card glow><Label color={C.accent}>Your Next Step</Label><div style={{fontSize:15,fontWeight:700,color:C.text,lineHeight:1.6}}>{r.nextStep}</div></Card>
                </>
              );
            })()}
            {unblockResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{unblockResult.raw}</div></Card>}
          </div>
        )}

      </div>
    </div>
  );
}
