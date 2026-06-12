import { useState, useRef } from "react";

const APP_PASSWORD = "aldavincii2M";

const CREATOR_DNA = `@aldavincii — TikTok creator approaching 1M followers. Mother-son dynamic (strongest content), spontaneous travel, comedy/reaction. Brand deals: Amazon, Netflix, Paramount, Lionsgate, Universal. Film/TV degree. Baltimore MD. Goal: scale past 1M consistently.`;

const TIKTOK_ALGO = `TikTok Algorithm: Completion rate (35%), Rewatch/loops (20%), Shares (18%), Comments (12%), Likes (8%), Saves (7%). Hook window: 0.5s determines swipe, 3s determines completion. Optimal length: 7-15s max completion, 21-34s storytelling. Shares = 3x weight of likes. Questions in captions increase comments 40%. Trending audio = 2.1x reach in 48hrs. Original audio = 1.4x reach.`;

const C = {
  bg:"#07080F",surface:"#0D0F1C",card:"#111320",border:"#1C1F35",
  accent:"#7C6FFF",green:"#00E5A0",amber:"#FFB547",red:"#FF5C5C",
  pink:"#FF4ECD",blue:"#38BDF8",text:"#EEEEF5",muted:"#6B6F8A",dim:"#393D5C",
};

async function geminiText(key,prompt){
  const body={contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.7,maxOutputTokens:3000}};
  const res=await fetch("/api/gemini",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,body})});
  const d=await res.json();
  if(d.error)throw new Error("Gemini: "+(d.error.message||JSON.stringify(d.error)));
  return d.candidates?.[0]?.content?.parts?.[0]?.text||"";
}

async function geminiVideo(key,base64,mimeType,prompt){
  // Call Google directly for video — avoids Vercel 4.5MB payload limit
  const body={contents:[{parts:[{text:prompt},{inline_data:{mime_type:mimeType,data:base64}}]}],generationConfig:{temperature:0.3,maxOutputTokens:4096}};
  const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const d=await res.json();
  if(d.error)throw new Error("Gemini: "+(d.error.message||JSON.stringify(d.error)));
  return d.candidates?.[0]?.content?.parts?.[0]?.text||"";
}

async function apifyVideo(token,url){
  const res=await fetch("/api/apify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,body:{postURLs:[url],resultsPerPage:1,shouldDownloadVideos:false,shouldDownloadCovers:false}})});
  const d=await res.json();
  if(!d||!d.length)throw new Error("Apify: no data returned. Check the URL.");
  return d[0];
}

async function apifyProfile(token,handle,count){
  const h=handle.replace("https://www.tiktok.com/@","").replace("@","").split("?")[0].trim();
  const res=await fetch("/api/apify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,body:{profiles:[h],resultsPerPage:count,shouldDownloadVideos:false,shouldDownloadCovers:false}})});
  const d=await res.json();
  if(!d||!d.length)throw new Error("Apify: couldn't find that profile.");
  return d;
}

async function claude(sys,usr){
  const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-opus-4-5",max_tokens:1000,system:sys,messages:[{role:"user",content:usr}]})});
  const d=await res.json();
  if(d.error)throw new Error("Claude: "+d.error.message);
  return d.content[0].text;
}

function pj(text){
  const m=text.match(/```json([\s\S]*?)```/);
  if(m){try{return JSON.parse(m[1].trim());}catch{}}
  try{return JSON.parse(text.trim());}catch{}
  return null;
}

function fmt(n){
  if(!n&&n!==0)return"—";
  if(n>=1000000)return(n/1000000).toFixed(1)+"M";
  if(n>=1000)return(n/1000).toFixed(1)+"K";
  return String(n);
}

async function fileToBase64(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=e=>res(e.target.result.split(",")[1]);
    r.onerror=rej;
    r.readAsDataURL(file);
  });
}

// ── UI ────────────────────────────────────────────────────────────────────────
function Bar({label,score,color}){
  return(
    <div style={{marginBottom:13}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>{label}</span>
        <span style={{fontSize:11,color,fontWeight:800}}>{score}<span style={{color:C.dim}}>/10</span></span>
      </div>
      <div style={{height:3,background:C.border,borderRadius:99}}>
        <div style={{height:"100%",width:`${(score||0)*10}%`,background:`linear-gradient(90deg,${color}77,${color})`,borderRadius:99,transition:"width 1s ease"}}/>
      </div>
    </div>
  );
}
function Chip({children,color=C.accent}){
  return <span style={{display:"inline-block",padding:"2px 9px",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",background:color+"22",color,marginRight:5,marginBottom:5,border:`1px solid ${color}33`}}>{children}</span>;
}
function Card({children,glow,accent,style={}}){
  const bc=glow?C.accent+"55":accent?accent+"44":C.border;
  return <div style={{background:C.card,borderRadius:14,border:`1px solid ${bc}`,boxShadow:glow?`0 0 24px ${C.accent}15`:"none",padding:"16px",marginBottom:13,...style}}>{children}</div>;
}
function Lbl({children,color=C.accent}){
  return <div style={{fontSize:9,fontWeight:800,letterSpacing:"0.15em",color,textTransform:"uppercase",marginBottom:9}}>{children}</div>;
}
function Row({icon,label,value,color=C.text}){
  return(
    <div style={{display:"flex",gap:10,marginBottom:9,alignItems:"flex-start"}}>
      {icon&&<span style={{color,flexShrink:0}}>{icon}</span>}
      {label&&<span style={{fontSize:11,color:C.muted,flexShrink:0,minWidth:80}}>{label}</span>}
      <span style={{fontSize:13,color,lineHeight:1.5}}>{value}</span>
    </div>
  );
}
function TIn({placeholder,value,onChange,type="text",rows}){
  const s={width:"100%",background:"#090B16",border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 13px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
  return rows?<textarea {...{placeholder,value,onChange,rows}} style={{...s,resize:"vertical"}}/>:<input {...{type,placeholder,value,onChange}} style={s}/>;
}
function Btn({children,onClick,disabled,color=C.accent,full,small}){
  return <button onClick={onClick} disabled={disabled} style={{width:full?"100%":"auto",padding:small?"7px 14px":"12px 20px",border:"none",borderRadius:10,background:disabled?C.dim:`linear-gradient(135deg,${color},${color}AA)`,color:disabled?C.muted:"#fff",fontSize:small?11:13,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.6:1}}>{children}</button>;
}
function Stat({label,value,color=C.accent}){
  return(
    <div style={{background:C.surface,borderRadius:10,padding:"10px 12px",textAlign:"center",border:`1px solid ${C.border}`}}>
      <div style={{fontSize:15,fontWeight:900,color}}>{value}</div>
      <div style={{fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:2}}>{label}</div>
    </div>
  );
}
function KIn({label,hint,value,onChange,saved,onSave,color=C.accent}){
  const [vis,setVis]=useState(false);
  return(
    <div style={{marginBottom:11}}>
      <div style={{fontSize:9,fontWeight:800,letterSpacing:"0.13em",color:saved?C.green:color,textTransform:"uppercase",marginBottom:6}}>{saved?"✓ ":""}{label}</div>
      <div style={{display:"flex",gap:7}}>
        <TIn type={vis?"text":"password"} placeholder={hint} value={value} onChange={e=>onChange(e.target.value)}/>
        <button onClick={()=>setVis(!vis)} style={{background:C.border,border:"none",borderRadius:8,color:C.muted,cursor:"pointer",padding:"0 10px",fontSize:13,flexShrink:0}}>{vis?"🙈":"👁"}</button>
        <Btn onClick={onSave} color={saved?C.green:color} small>{saved?"✓":"Save"}</Btn>
      </div>
    </div>
  );
}

// Media input — URL or file upload
function MediaInput({label,urlVal,onUrlChange,file,preview,onFile,onClear,fileAccept="video/*",urlPlaceholder="https://www.tiktok.com/@username/video/..."}){
  const ref=useRef(null);
  const [mode,setMode]=useState("url");
  return(
    <div style={{marginBottom:12}}>
      {label&&<Lbl>{label}</Lbl>}
      <div style={{display:"flex",gap:7,marginBottom:10}}>
        {["url","upload"].map(m=>(
          <button key={m} onClick={()=>setMode(m)} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${mode===m?C.accent:C.border}`,background:mode===m?C.accent+"18":"transparent",color:mode===m?C.accent:C.muted,fontSize:12,cursor:"pointer",fontWeight:mode===m?700:400}}>
            {m==="url"?"🔗 URL":"📁 Upload"}
          </button>
        ))}
      </div>
      {mode==="url"?(
        <TIn placeholder={urlPlaceholder} value={urlVal} onChange={e=>onUrlChange(e.target.value)}/>
      ):(
        <>
          <input ref={ref} type="file" accept={fileAccept} style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f)onFile(f);}}/>
          {!preview?(
            <div onClick={()=>ref.current?.click()} style={{border:`2px dashed ${C.border}`,borderRadius:12,padding:"28px 20px",textAlign:"center",cursor:"pointer"}}>
              <div style={{fontSize:28,marginBottom:6}}>📱</div>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:3}}>Tap to upload</div>
              <div style={{fontSize:11,color:C.muted}}>MP4, MOV, or image files</div>
            </div>
          ):(
            <div>
              {file?.type?.startsWith("video")?
                <video src={preview} controls style={{width:"100%",borderRadius:10,marginBottom:8,maxHeight:260}}/>:
                <img src={preview} style={{width:"100%",borderRadius:10,marginBottom:8,maxHeight:260,objectFit:"cover"}} alt="preview"/>
              }
              <div style={{display:"flex",gap:7}}>
                <Btn onClick={onClear} color={C.red} small>Remove</Btn>
                <Btn onClick={()=>ref.current?.click()} color={C.dim} small>Change</Btn>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const ec=(e)=>e==="Low"?C.green:e==="Medium"?C.amber:C.red;

const TABS=[
  {id:"profile",label:"Profile",icon:"👤"},
  {id:"predict",label:"Predict",icon:"🎯"},
  {id:"deepdive",label:"Deep Dive",icon:"🧠"},
  {id:"competitor",label:"Competitor",icon:"🔍"},
  {id:"script",label:"Script",icon:"✍️"},
  {id:"analyze",label:"Analyze Me",icon:"🔬"},
  {id:"strategy",label:"Strategy",icon:"🧭"},
  {id:"brand",label:"Brand ID",icon:"⭐"},
  {id:"calendar",label:"Calendar",icon:"📅"},
  {id:"unblock",label:"Unblock",icon:"💡"},
];

export default function App(){
  const [unlocked,setUnlocked]=useState(false);
  const [pw,setPw]=useState("");
  const [pwErr,setPwErr]=useState(false);
  const [tab,setTab]=useState("predict");
  const [gKey,setGKey]=useState("");
  const [gSaved,setGSaved]=useState(false);
  const [aKey,setAKey]=useState("");
  const [aSaved,setASaved]=useState(false);
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState("");
  const [err,setErr]=useState("");

  // Profile
  const [profHandle,setProfHandle]=useState("");
  const [profCount,setProfCount]=useState(20);
  const [profResult,setProfResult]=useState(null);

  // Predict
  const [predUrl,setPredUrl]=useState("");
  const [predFile,setPredFile]=useState(null);
  const [predPreview,setPredPreview]=useState("");
  const [predResult,setPredResult]=useState(null);

  // Deep Dive
  const [deepUrl,setDeepUrl]=useState("");
  const [deepFile,setDeepFile]=useState(null);
  const [deepPreview,setDeepPreview]=useState("");
  const [deepText,setDeepText]=useState("");
  const [deepResult,setDeepResult]=useState(null);

  // Competitor
  const [compUrl,setCompUrl]=useState("");
  const [compFile,setCompFile]=useState(null);
  const [compPreview,setCompPreview]=useState("");
  const [compResult,setCompResult]=useState(null);

  // Script
  const [scriptTopic,setScriptTopic]=useState("");
  const [scriptAngle,setScriptAngle]=useState("mother-son");
  const [scriptResult,setScriptResult]=useState(null);

  // Analyze Me
  const [myUrl,setMyUrl]=useState("");
  const [myFile,setMyFile]=useState(null);
  const [myPreview,setMyPreview]=useState("");
  const [myText,setMyText]=useState("");
  const [myResult,setMyResult]=useState(null);

  const [stratResult,setStratResult]=useState(null);
  const [brandResult,setBrandResult]=useState(null);
  const [calFocus,setCalFocus]=useState("mixed");
  const [calResult,setCalResult]=useState(null);
  const [blockText,setBlockText]=useState("");
  const [unblockResult,setUnblockResult]=useState(null);

  const run=async(fn)=>{setErr("");setLoading(true);try{await fn();}catch(e){setErr(e.message);}setLoading(false);setMsg("");};

  // Get video analysis from Gemini (handles both URL and file)
  async function analyzeWithGemini(url,file,customPrompt){
    if(file){
      const b64=await fileToBase64(file);
      return geminiVideo(gKey,b64,file.type||"video/mp4",customPrompt);
    }
    if(url){
      return geminiText(gKey,`Analyze this TikTok video: ${url}\n\n${customPrompt}`);
    }
    return "";
  }

  // Get stats from Apify
  async function getStats(url){
    if(!aSaved||!url)return null;
    try{return await apifyVideo(aKey,url);}catch(e){return null;}
  }

  function buildStatsBlock(v){
    if(!v)return"No stats available.";
    const fans=v.authorMeta?.fans||1;
    const views=v.playCount||0;
    const likes=v.diggCount||0;
    const comments=v.commentCount||0;
    const shares=v.shareCount||0;
    const sr=views>0?((shares/views)*100).toFixed(2):0;
    const lr=views>0?((likes/views)*100).toFixed(2):0;
    const cr=views>0?((comments/views)*100).toFixed(2):0;
    return `Caption: "${v.desc||"none"}"\nViews: ${fmt(views)} | Likes: ${fmt(likes)} | Comments: ${fmt(comments)} | Shares: ${fmt(shares)}\nDuration: ${v.video?.duration}s | Followers: ${fmt(fans)}\nShare ratio: ${sr}% (viral=1%+) | Like ratio: ${lr}% (viral=5%+) | Comment ratio: ${cr}%\nHashtags: ${(v.textExtra||[]).map(t=>t.hashtagName).filter(Boolean).join(", ")||"none"}\nMusic: ${v.musicMeta?.musicName||"unknown"} (${v.musicMeta?.musicOriginal?"Original":"Trending"})`;
  }

  // ── PREDICT ──────────────────────────────────────────────────────────────────
  const runPredict=()=>run(async()=>{
    if(!gSaved)throw new Error("Connect Gemini key first.");
    if(!predFile&&!predUrl)throw new Error("Upload a video or paste a URL.");

    let statsData=null;
    if(predUrl){
      setMsg("Pulling engagement stats...");
      statsData=await getStats(predUrl);
    }
    const statsBlock=buildStatsBlock(statsData);

    setMsg("Gemini watching every frame...");
    const gemPrompt=`You are a TikTok viral expert. Watch this video carefully — every word spoken, every visual, every cut, every text overlay.

Give the most detailed specific analysis possible. Quote ACTUAL words you hear. Reference EXACT timestamps.

${statsData?`REAL PERFORMANCE DATA:\n${statsBlock}`:""}

CREATOR CONTEXT: ${CREATOR_DNA}
ALGORITHM KNOWLEDGE: ${TIKTOK_ALGO}

Return ONLY valid JSON in \`\`\`json blocks:
{
  "verdict": "POST IT / NEEDS WORK / RESHOOT",
  "viralProbability": "X% chance of hitting 100K",
  "predictedViews": "realistic range e.g. 50K-500K",
  "confidence": "Low/Medium/High",
  "overallViralScore": 8,
  "hookScore": 8,
  "retentionScore": 8,
  "shareabilityScore": 8,
  "emotionScore": 8,
  "loopScore": 8,
  "commentBaitScore": 8,
  "algorithmGrade": "A",
  "exactOpeningLine": "quote the actual first words spoken",
  "exactHook": "describe exactly what happens in first 3 seconds",
  "hookAnalysis": "detailed honest assessment with exact quotes",
  "scriptAnalysis": {
    "pacing": "short and punchy vs slow — be specific",
    "peakMoment": "exact best moment with timestamp",
    "weakMoment": "exact weakest moment with timestamp",
    "shareableLine": "exact line most likely to cause shares",
    "commentableLine": "exact line most likely to cause comments",
    "narrativeArc": "setup tension payoff — does it exist?"
  },
  "visualAnalysis": {
    "cameraWork": "specific assessment",
    "editing": "cuts pacing transitions — specific",
    "textOverlays": "effective or not and why",
    "creatorEnergy": "authentic forced tired excited — specific"
  },
  "audioAnalysis": {
    "type": "Original or Trending",
    "effectiveness": "does it match the energy",
    "clarity": "is voice clear and engaging"
  },
  "editingNotes": [
    "specific edit suggestion 1 with timestamp",
    "edit suggestion 2",
    "edit suggestion 3",
    "edit suggestion 4",
    "edit suggestion 5"
  ],
  "viewerPsychology": {
    "firstHalfSecond": "exactly what viewer sees and thinks",
    "threeSecondTest": "STAY or SWIPE and exact reason",
    "emotionalJourney": "the complete emotional arc beat by beat",
    "dropOffPoint": "exact moment and reason most viewers leave",
    "shareThought": "exact thought that makes someone share"
  },
  "algorithmSignals": {
    "loopPotential": "does end connect to beginning",
    "commentBait": "what sparks debate or reaction",
    "shareTrigger": "the I need to send this moment",
    "saveTrigger": "anything worth saving",
    "stitchDuetPotential": "would others respond to this"
  },
  "retentionKillers": ["specific moment 1 with why", "moment 2", "moment 3"],
  "retentionBoosts": ["specific boost 1", "boost 2"],
  "rewrittenHook": "exact rewritten opening 3x stronger",
  "fixBeforePosting": ["specific fix 1", "fix 2", "fix 3", "fix 4"],
  "viralVersion": "scene by scene how to reshoot for 1M views",
  "rewrittenCaption": "optimized caption with hashtags",
  "bestTimeToPost": "specific day time with reasoning",
  "competitorAngle": "how a top creator would do this topic",
  "confidenceScore": "X% confidence"
}`;

    const gemText=await analyzeWithGemini(predUrl,predFile,gemPrompt);
    const gemData=pj(gemText);

    if(gemData){
      setMsg("Claude adding growth strategy...");
      try{
        const claudeRaw=await claude(
          `TikTok growth strategist. Gemini analyzed the video. Add strategic layer. Creator: ${CREATOR_DNA}. Algorithm: ${TIKTOK_ALGO}`,
          `Gemini analysis: ${JSON.stringify(gemData)}\n\nAdd these fields as JSON in \`\`\`json blocks:\n{"strategyNote":"specific strategic insight for this creator","nextThreeVideos":["concept 1","concept 2","concept 3"],"algorithmPlay":"specific algorithm strategy being missed","growthTrajectory":"prediction posted as-is vs after fixes","brandAlignment":"1-10 score and why this fits or doesn't fit creator brand"}`
        );
        const cl=pj(claudeRaw);
        setPredResult({...gemData,...(cl||{})});
      }catch(e){setPredResult(gemData);}
    }else{
      setPredResult({raw:gemText});
    }
  });

  // ── DEEP DIVE ─────────────────────────────────────────────────────────────────
  const runDeepDive=()=>run(async()=>{
    if(!gSaved)throw new Error("Connect Gemini key first.");
    if(!deepUrl&&!deepFile&&!deepText)throw new Error("Paste a URL, upload a file, or describe your video.");

    let statsData=null;
    if(deepUrl){
      setMsg("Pulling real engagement data...");
      statsData=await getStats(deepUrl);
    }
    const statsBlock=buildStatsBlock(statsData);

    setMsg("Gemini analyzing script and content...");
    const gemPrompt=`You are a TikTok algorithm expert AND script analyst AND viewer psychology specialist.

${deepText?`Creator's description: ${deepText}`:"Watch this video carefully — quote actual words, reference exact moments."}

${statsData?`REAL DATA:\n${statsBlock}`:""}

ALGORITHM: ${TIKTOK_ALGO}

Analyze with surgical precision. Return ONLY valid JSON in \`\`\`json blocks:
{
  "viralProbability": "X% chance of hitting 100K",
  "algorithmScore": 7,
  "viewerScore": 7,
  "hookScore": 7,
  "retentionScore": 7,
  "shareabilityScore": 7,
  "loopScore": 7,
  "commentBaitScore": 7,
  "algorithmGrade": "B",
  "completionRateEstimate": "estimated % who watch to end",
  "rewatchPotential": "Low/Medium/High with reasoning",
  "algorithmReport": {
    "shareDriver": "what would make someone share",
    "commentDriver": "what would make someone comment",
    "saveDriver": "what would make someone save",
    "soundStrategy": "audio assessment",
    "hashtagEfficiency": "hashtag assessment"
  },
  "viewerPsychology": {
    "firstHalfSecond": "exact viewer thought",
    "threeSecondTest": "STAY or SWIPE with exact reason",
    "emotionalJourney": "complete emotional arc",
    "dropOffPoint": "exact moment most viewers leave",
    "shareThought": "exact thought that causes share"
  },
  "secondBySecond": [
    {"timestamp":"0-3s","what":"what happens","viewerReaction":"what viewer thinks","algorithmSignal":"what algorithm measures"},
    {"timestamp":"3-10s","what":"...","viewerReaction":"...","algorithmSignal":"..."},
    {"timestamp":"10-20s","what":"...","viewerReaction":"...","algorithmSignal":"..."},
    {"timestamp":"20-end","what":"...","viewerReaction":"...","algorithmSignal":"..."}
  ],
  "hookAutopsy": "detailed hook breakdown with exact quotes",
  "retentionKillers": ["specific kill 1","kill 2","kill 3"],
  "retentionBoosts": ["specific boost 1","boost 2"],
  "algorithmFixes": ["specific fix 1","fix 2","fix 3","fix 4"],
  "rewrittenHook": "exact rewritten hook 3x stronger",
  "rewrittenCaption": "optimized caption with hashtags",
  "optimalPostTime": "specific day and time with reasoning",
  "viralVersion": "exact scene by scene reshoot for 1M views",
  "competitorAngle": "how top creator would do this",
  "verdict": "POST NOW / RESHOOT FIRST / CONCEPT CHANGE",
  "confidenceScore": "X% confidence"
}`;

    const gemText=await analyzeWithGemini(deepUrl,deepFile,gemPrompt);
    const gemData=pj(gemText)||{raw:gemText};
    setDeepResult({...gemData,engagement:statsData});
  });

  // ── PROFILE ──────────────────────────────────────────────────────────────────
  const runProfile=()=>run(async()=>{
    if(!aSaved)throw new Error("Apify token required for profile analysis.");
    if(!gSaved)throw new Error("Connect Gemini key first.");
    if(!profHandle)throw new Error("Enter a TikTok profile URL or @handle.");
    setMsg(`Pulling last ${profCount} videos...`);
    const videos=await apifyProfile(aKey,profHandle,profCount);
    const totalViews=videos.reduce((a,v)=>a+(v.playCount||0),0);
    const totalLikes=videos.reduce((a,v)=>a+(v.diggCount||0),0);
    const avgViews=Math.round(totalViews/videos.length);
    const avgEng=videos[0]?.authorMeta?.fans?((totalLikes/videos.length)/videos[0].authorMeta.fans*100).toFixed(2):null;
    const sorted=[...videos].sort((a,b)=>(b.playCount||0)-(a.playCount||0));
    const top5=sorted.slice(0,5);
    const bottom5=sorted.slice(-5);
    setMsg("AI analyzing your patterns...");
    const raw=await claude(
      `TikTok data analyst. Analyze real video data only — no assumptions. Reference actual captions and numbers. Return ONLY valid JSON in \`\`\`json blocks: {"overallGrade":"A-F","channelHealth":7,"consistencyScore":7,"hookStrengthAvg":7,"engagementScore":7,"growthMomentum":7,"executiveSummary":"2-3 honest sentences from data","topPatterns":["pattern from actual top videos","p2","p3"],"floppingPatterns":["pattern from low videos","p2"],"bestContentType":"from data","worstContentType":"from data","avgViewsRead":"1 sentence","hiddenStrength":"data insight","biggestLeak":"data insight","contentGaps":["gap1","gap2","gap3"],"doubleDown":"what to post more of","dropImmediately":"what to stop","next30Days":"specific action plan","pathTo2M":"realistic path"}`,
      `Handle: ${profHandle} | Followers: ${fmt(videos[0]?.authorMeta?.fans)} | Avg views: ${fmt(avgViews)} | Eng rate: ${avgEng?avgEng+"%":"N/A"}\n\nTOP 5:\n${top5.map((v,i)=>`${i+1}. "${v.desc?.slice(0,80)||"No caption"}" — ${fmt(v.playCount)} views, ${fmt(v.diggCount)} likes, ${v.video?.duration}s`).join("\n")}\n\nBOTTOM 5:\n${bottom5.map((v,i)=>`${i+1}. "${v.desc?.slice(0,80)||"No caption"}" — ${fmt(v.playCount)} views`).join("\n")}\n\nALL:\n${videos.map(v=>`"${v.desc?.slice(0,60)||"no caption"}" | ${fmt(v.playCount)} views | ${fmt(v.diggCount)} likes | ${v.video?.duration}s`).join("\n")}`
    );
    setProfResult({...(pj(raw)||{raw}),stats:{totalViews,totalLikes,avgViews,avgEng,followers:videos[0]?.authorMeta?.fans},top5,bottom5,count:videos.length});
  });

  // ── COMPETITOR ────────────────────────────────────────────────────────────────
  const runComp=()=>run(async()=>{
    if(!gSaved)throw new Error("Connect Gemini key first.");
    if(!compUrl&&!compFile)throw new Error("Paste a URL or upload a video.");
    let statsData=null;
    if(compUrl){setMsg("Pulling stats...");statsData=await getStats(compUrl);}
    const statsBlock=buildStatsBlock(statsData);
    setMsg("Analyzing with AI...");
    const gemText=await analyzeWithGemini(compUrl,compFile,`Analyze this TikTok for viral patterns. Stats:\n${statsBlock}\n\nAnalyze: hook, structure, pacing, emotional driver, what makes people watch till end. Be specific.`);
    setMsg("Building cheat sheet...");
    const raw=await claude(
      `Viral strategist. Extract the formula. Return ONLY valid JSON in \`\`\`json blocks: {"title":"formula name","viralScore":8,"hookScore":8,"retentionScore":8,"shareabilityScore":8,"emotionScore":8,"performanceSummary":"1 sentence on real numbers","hookBreakdown":"exact hook breakdown","structure":["beat 1","beat 2","beat 3","beat 4","beat 5"],"whyItWorks":"core mechanics","emotionalDriver":"emotion","formula":"one sentence formula","steal":["specific thing 1","thing 2","thing 3"],"avoid":["weakness"],"tags":["tag1","tag2","tag3"]}`,
      `Gemini: ${gemText}\n\nStats: ${statsBlock}\n\nURL: ${compUrl||"uploaded file"}`
    );
    setCompResult({...(pj(raw)||{raw}),engagement:statsData});
  });

  // ── SCRIPT ────────────────────────────────────────────────────────────────────
  const runScript=()=>run(async()=>{
    if(!gSaved)throw new Error("Connect Gemini key first.");
    if(!scriptTopic)throw new Error("Enter a topic.");
    setMsg("Writing your script...");
    const raw=await geminiText(gKey,`TikTok scriptwriter. Write a viral script. Topic: ${scriptTopic}. Angle: ${scriptAngle}. Creator context: ${CREATOR_DNA}.\nReturn ONLY valid JSON in \`\`\`json blocks: {"title":"concept","hook":"exact first line","whyThisHook":"why stops scroll","script":[{"beat":"Hook","action":"what you do","dialogue":"what you say","duration":"0-3s"},{"beat":"Setup","action":"...","dialogue":"...","duration":"3-8s"},{"beat":"Turn","action":"...","dialogue":"...","duration":"8-20s"},{"beat":"Payoff","action":"...","dialogue":"...","duration":"20-35s"},{"beat":"CTA","action":"...","dialogue":"...","duration":"35-45s"}],"visualDirection":"specific camera cuts overlays","soundStrategy":"specific music","caption":"full caption with hashtags","viralPotential":8,"whyItWillWork":"2 specific sentences"}`);
    setScriptResult(pj(raw)||{raw});
  });

  // ── ANALYZE ME ────────────────────────────────────────────────────────────────
  const runAnalyze=()=>run(async()=>{
    if(!gSaved)throw new Error("Connect Gemini key first.");
    if(!myUrl&&!myFile&&!myText)throw new Error("Paste a URL, upload a file, or describe your video.");
    let statsData=null;
    if(myUrl){setMsg("Pulling your stats...");statsData=await getStats(myUrl);}
    const statsBlock=buildStatsBlock(statsData);
    setMsg("Analyzing your video...");
    const gemText=myText?`Creator's description: ${myText}`:await analyzeWithGemini(myUrl,myFile,`Analyze this creator's TikTok honestly. Stats:\n${statsBlock}\n\nHook quality, structure, pacing, what works, what's missing. Be direct.`);
    setMsg("Building breakdown...");
    const raw=await claude(
      `Senior TikTok strategist. Brutally honest analysis. Creator: ${CREATOR_DNA}. Return ONLY valid JSON in \`\`\`json blocks: {"overallScore":7,"hookScore":7,"retentionScore":7,"brandScore":7,"growthScore":7,"numbersRead":"honest stats interpretation","whatWorked":["win 1","win 2","win 3"],"whatMissed":["miss 1","miss 2"],"hookAnalysis":"honest 2 sentences","brandAnalysis":"brand fit assessment","ceiling":"what limits this video","breakthroughMove":"ONE change for 2x performance","patternInsight":"content pattern revealed","nextVideo":"exactly what to film next","directNote":"honest growth message"}`,
      `Analysis: ${gemText}\n\nStats: ${statsBlock}`
    );
    setMyResult({...(pj(raw)||{raw}),engagement:statsData});
  });

  // ── STRATEGY ─────────────────────────────────────────────────────────────────
  const runStrat=()=>run(async()=>{
    if(!gSaved)throw new Error("Connect Gemini key first.");
    setMsg("Building strategy...");
    const ctx=profResult?`Real data: avg views ${fmt(profResult.stats?.avgViews)}, best content: ${profResult.bestContentType}, leak: ${profResult.biggestLeak}`:"No profile data yet.";
    const raw=await geminiText(gKey,`TikTok growth strategist. Creator: ${CREATOR_DNA}. ${ctx}\nReturn ONLY valid JSON in \`\`\`json blocks: {"coreIdentity":"what this creator is","biggestAsset":"most underutilized asset","niches":[{"name":"niche","why":"why fits","potential":"potential","competitors":"who owns it","howToWin":"angle","urgency":"why now","difficulty":"Easy/Medium/Hard"},{"name":"...","why":"...","potential":"...","competitors":"...","howToWin":"...","urgency":"...","difficulty":"..."},{"name":"...","why":"...","potential":"...","competitors":"...","howToWin":"...","urgency":"...","difficulty":"..."},{"name":"...","why":"...","potential":"...","competitors":"...","howToWin":"...","urgency":"...","difficulty":"..."}],"topNiche":"top pick and why","brandGaps":["gap1","gap2","gap3"],"revenueAngles":["angle1","angle2","angle3"],"milestoneRoadmap":["to 1M","to 2M","to 5M"],"hardTruth":"honest thing holding back"}`);
    setStratResult(pj(raw)||{raw});
  });

  // ── BRAND ─────────────────────────────────────────────────────────────────────
  const runBrand=()=>run(async()=>{
    if(!gSaved)throw new Error("Connect Gemini key first.");
    setMsg("Defining your brand...");
    const ctx=profResult?`Top content: ${profResult.top5?.map(v=>v.desc?.slice(0,50)).join(" | ")}`:"";
    const raw=await geminiText(gKey,`Brand strategist. Creator: ${CREATOR_DNA}. ${ctx}\nReturn ONLY valid JSON in \`\`\`json blocks: {"brandStatement":"one powerful sentence","tagline":"5 words max","coreValues":["value 1","value 2","value 3"],"audience":{"primary":"who watches now","aspirational":"who to target next","psychographic":"what they believe"},"contentPillars":[{"pillar":"name","description":"in practice","percentage":"%"},{"pillar":"...","description":"...","percentage":"..."},{"pillar":"...","description":"...","percentage":"..."},{"pillar":"...","description":"...","percentage":"..."}],"toneOfVoice":["trait1","trait2","trait3"],"whatMakesDifferent":"specific differentiator","whatToStop":"dilutes brand","brandComps":["comp1","comp2","comp3"],"northStar":"at 5M vision"}`);
    setBrandResult(pj(raw)||{raw});
  });

  // ── CALENDAR ─────────────────────────────────────────────────────────────────
  const runCal=()=>run(async()=>{
    if(!gSaved)throw new Error("Connect Gemini key first.");
    setMsg("Building calendar...");
    const raw=await geminiText(gKey,`TikTok content strategist. Creator: ${CREATOR_DNA}. Focus: ${calFocus}.\nReturn ONLY valid JSON in \`\`\`json blocks: {"weekTheme":"theme","days":[{"day":"Monday","concept":"specific concept","hook":"exact hook","angle":"angle","effort":"Low/Medium/High","viralPotential":8,"notes":"tip"},{"day":"Tuesday","concept":"...","hook":"...","angle":"...","effort":"Low","viralPotential":7,"notes":"..."},{"day":"Wednesday","concept":"...","hook":"...","angle":"...","effort":"Medium","viralPotential":9,"notes":"..."},{"day":"Thursday","concept":"...","hook":"...","angle":"...","effort":"Low","viralPotential":7,"notes":"..."},{"day":"Friday","concept":"...","hook":"...","angle":"...","effort":"High","viralPotential":9,"notes":"..."},{"day":"Saturday","concept":"...","hook":"...","angle":"...","effort":"Medium","viralPotential":8,"notes":"..."},{"day":"Sunday","concept":"...","hook":"...","angle":"...","effort":"Low","viralPotential":6,"notes":"..."}],"heroVideo":"hero day and why","repurposeTip":"one video into 3"}`);
    setCalResult(pj(raw)||{raw});
  });

  // ── UNBLOCK ───────────────────────────────────────────────────────────────────
  const runUnblock=()=>run(async()=>{
    if(!gSaved)throw new Error("Connect Gemini key first.");
    setMsg("Breaking through your block...");
    const raw=await geminiText(gKey,`Creative director for TikTok creator. Feeling: "${blockText||"general creative block"}". Creator: ${CREATOR_DNA}.\nReturn ONLY valid JSON in \`\`\`json blocks: {"reframe":"what block is telling them","rootCause":"real reason","immediateAction":"do TODAY","ideas":[{"title":"idea","hook":"exact hook","angle":"angle","viralPotential":8,"whyNow":"why now","effort":"Low/Medium/High"},{"title":"...","hook":"...","angle":"...","viralPotential":7,"whyNow":"...","effort":"..."},{"title":"...","hook":"...","angle":"...","viralPotential":9,"whyNow":"...","effort":"..."},{"title":"...","hook":"...","angle":"...","viralPotential":8,"whyNow":"...","effort":"..."},{"title":"...","hook":"...","angle":"...","viralPotential":7,"whyNow":"...","effort":"..."},{"title":"...","hook":"...","angle":"...","viralPotential":8,"whyNow":"...","effort":"..."}],"mindsetShift":"direct shift","reminder":"progress reminder","nextStep":"literal next step"}`);
    setUnblockResult(pj(raw)||{raw});
  });

  // ── PASSWORD ──────────────────────────────────────────────────────────────────
  if(!unlocked){
    return(
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Inter',-apple-system,sans-serif"}}>
        <style>{`*{box-sizing:border-box;}input{color-scheme:dark;}`}</style>
        <div style={{width:"100%",maxWidth:360}}>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,${C.accent},#B06FFF)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 14px"}}>⚡</div>
            <div style={{fontSize:20,fontWeight:900,color:C.text,marginBottom:4}}>Viral Research Machine</div>
            <div style={{fontSize:11,color:C.muted}}>PRIVATE ACCESS ONLY</div>
          </div>
          <div style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,padding:22}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:7}}>Password</div>
            <input type="password" placeholder="Enter password..." value={pw}
              onChange={e=>{setPw(e.target.value);setPwErr(false);}}
              onKeyDown={e=>e.key==="Enter"&&(pw===APP_PASSWORD?setUnlocked(true):setPwErr(true))}
              style={{width:"100%",background:"#090B16",border:pwErr?`1px solid ${C.red}`:`1px solid ${C.border}`,borderRadius:10,padding:"11px 13px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:9,fontFamily:"inherit"}}
            />
            {pwErr&&<div style={{fontSize:12,color:C.red,marginBottom:9}}>Wrong password.</div>}
            <button onClick={()=>pw===APP_PASSWORD?setUnlocked(true):setPwErr(true)}
              style={{width:"100%",padding:13,background:`linear-gradient(135deg,${C.accent},#B06FFF)`,border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
              Unlock ⚡
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN APP ──────────────────────────────────────────────────────────────────
  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:80}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;}textarea,input{color-scheme:dark;}`}</style>

      {/* Header */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"18px 16px 0"}}>
        <div style={{maxWidth:680,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${C.accent},#B06FFF)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⚡</div>
            <div>
              <div style={{fontSize:16,fontWeight:900,letterSpacing:"-0.02em"}}>Viral Research Machine</div>
              <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginTop:1}}>GEMINI + APIFY + CLAUDE · PURE DATA</div>
            </div>
          </div>
          <div style={{display:"flex",overflowX:"auto",scrollbarWidth:"none"}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{flexShrink:0,padding:"8px 11px",border:"none",cursor:"pointer",background:"transparent",fontSize:10,fontWeight:tab===t.id?800:500,color:tab===t.id?C.accent:C.muted,borderBottom:`2px solid ${tab===t.id?C.accent:"transparent"}`,transition:"all 0.15s",whiteSpace:"nowrap"}}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto",padding:"18px 16px"}}>

        {/* API Keys */}
        <Card glow={gSaved&&aSaved}>
          <Lbl color={gSaved&&aSaved?C.green:C.amber}>{gSaved&&aSaved?"✓ All Systems Connected":"Connect Your APIs"}</Lbl>
          <KIn label="Gemini API Key" hint="aistudio.google.com → Get API Key" value={gKey} onChange={v=>{setGKey(v);setGSaved(false);}} saved={gSaved} onSave={()=>gKey.length>10&&setGSaved(true)} color={C.accent}/>
          <KIn label="Apify API Token" hint="apify.com → Settings → API & Integrations" value={aKey} onChange={v=>{setAKey(v);setASaved(false);}} saved={aSaved} onSave={()=>aKey.length>10&&setASaved(true)} color={C.amber}/>
          <div style={{fontSize:11,color:C.muted}}>Gemini watches videos · Apify pulls real data · Claude builds strategy · <span style={{color:C.dim}}>Keys stay in your browser only.</span></div>
        </Card>

        {err&&<div style={{background:"#1A0808",border:`1px solid ${C.red}40`,borderRadius:10,padding:"11px 14px",marginBottom:13,fontSize:13,color:C.red}}>⚠ {err}</div>}
        {loading&&(
          <div style={{background:C.card,border:`1px solid ${C.accent}30`,borderRadius:10,padding:"12px 16px",marginBottom:13,display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:14,height:14,border:`2px solid ${C.accent}`,borderTop:"2px solid transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/>
            <span style={{fontSize:13,color:C.muted}}>{msg||"Working..."}</span>
          </div>
        )}

        {/* ══ PREDICT ══ */}
        {tab==="predict"&&(
          <div>
            <Card glow>
              <Lbl color={C.accent}>🎯 Pre-Post Viral Prediction</Lbl>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:6}}>Upload your video OR paste a URL. Gemini watches every frame and quotes your actual words. Claude adds the growth strategy on top.</div>
              <div style={{fontSize:11,color:C.green}}>⚡ Most accurate when you upload the actual video file</div>
            </Card>
            <Card>
              <MediaInput label="Your Video" urlVal={predUrl} onUrlChange={setPredUrl} file={predFile} preview={predPreview} onFile={f=>{setPredFile(f);setPredPreview(URL.createObjectURL(f));setPredResult(null);}} onClear={()=>{setPredFile(null);setPredPreview("");}} urlPlaceholder="https://www.tiktok.com/@username/video/..."/>
              <Btn onClick={runPredict} disabled={loading||!gSaved||(!predFile&&!predUrl)} full>Analyze — Gemini + Claude 🎯</Btn>
            </Card>

            {predResult&&!predResult.raw&&(()=>{
              const r=predResult;
              const vc=r.verdict?.includes("POST IT")?C.green:r.verdict?.includes("NEEDS")?C.amber:C.red;
              return<>
                <Card glow accent={vc}>
                  <div style={{textAlign:"center",marginBottom:14}}>
                    <div style={{fontSize:22,fontWeight:900,color:vc,marginBottom:4}}>{r.verdict}</div>
                    <div style={{fontSize:17,fontWeight:800,color:C.text,marginBottom:4}}>{r.viralProbability}</div>
                    <div style={{fontSize:12,color:C.muted}}>Predicted: <b style={{color:C.text}}>{r.predictedViews}</b> · Grade: <b style={{color:vc,fontSize:15}}>{r.algorithmGrade}</b> · Confidence: <b style={{color:C.accent}}>{r.confidenceScore}</b></div>
                  </div>
                  <Bar label="Viral Score" score={r.overallViralScore} color={vc}/>
                  <Bar label="Hook" score={r.hookScore} color={C.green}/>
                  <Bar label="Retention" score={r.retentionScore} color={C.amber}/>
                  <Bar label="Shareability" score={r.shareabilityScore} color={C.pink}/>
                  <Bar label="Emotion" score={r.emotionScore} color="#FF9F47"/>
                  <Bar label="Loop Potential" score={r.loopScore} color={C.blue}/>
                  <Bar label="Comment Bait" score={r.commentBaitScore} color={C.pink}/>
                </Card>

                {r.exactOpeningLine&&<Card>
                  <Lbl color={C.green}>What Gemini Actually Heard</Lbl>
                  <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Your Opening Line</div>
                  <div style={{fontSize:15,fontWeight:800,color:C.text,background:C.surface,borderRadius:8,padding:"12px 14px",marginBottom:12,fontStyle:"italic"}}>"{r.exactOpeningLine}"</div>
                  <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Hook (First 3s)</div>
                  <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.exactHook}</div>
                </Card>}

                <Card>
                  <Lbl color={r.hookScore>=7?C.green:r.hookScore>=5?C.amber:C.red}>Hook Analysis</Lbl>
                  <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.hookAnalysis}</div>
                </Card>

                {r.scriptAnalysis&&<Card>
                  <Lbl color={C.accent}>Script Deep Dive</Lbl>
                  {r.scriptAnalysis.peakMoment&&<Row icon="🏆" label="Best Moment" value={`"${r.scriptAnalysis.peakMoment}"`} color={C.green}/>}
                  {r.scriptAnalysis.weakMoment&&<Row icon="⚠" label="Weak Moment" value={`"${r.scriptAnalysis.weakMoment}"`} color={C.red}/>}
                  {r.scriptAnalysis.shareableLine&&<Row icon="↗️" label="Share Trigger" value={`"${r.scriptAnalysis.shareableLine}"`} color={C.amber}/>}
                  {r.scriptAnalysis.commentableLine&&<Row icon="💬" label="Comment Bait" value={`"${r.scriptAnalysis.commentableLine}"`} color={C.blue}/>}
                  {r.scriptAnalysis.pacing&&<Row icon="⏱" label="Pacing" value={r.scriptAnalysis.pacing}/>}
                  {r.scriptAnalysis.narrativeArc&&<Row icon="📖" label="Story Arc" value={r.scriptAnalysis.narrativeArc}/>}
                </Card>}

                {r.editingNotes&&r.editingNotes.length>0&&<Card>
                  <Lbl color={C.amber}>✂️ Editing Notes</Lbl>
                  {r.editingNotes.map((n,i)=><Row key={i} icon={`${i+1}.`} value={n}/>)}
                </Card>}

                {r.visualAnalysis&&<Card>
                  <Lbl color={C.blue}>Visual Analysis</Lbl>
                  {Object.entries(r.visualAnalysis).map(([k,v])=><Row key={k} label={k.replace(/([A-Z])/g," $1").trim()} value={v}/>)}
                </Card>}

                {r.audioAnalysis&&<Card>
                  <Lbl color={C.blue}>Audio Analysis</Lbl>
                  {Object.entries(r.audioAnalysis).map(([k,v])=><Row key={k} label={k} value={v}/>)}
                </Card>}

                {r.viewerPsychology&&<Card>
                  <Lbl color={C.green}>Viewer Psychology</Lbl>
                  {Object.entries(r.viewerPsychology).map(([k,v])=>(
                    <div key={k} style={{background:C.surface,borderRadius:8,padding:"9px 12px",marginBottom:8}}>
                      <div style={{fontSize:9,color:C.green,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:3}}>{k.replace(/([A-Z])/g," $1").trim()}</div>
                      <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.5}}>{v}</div>
                    </div>
                  ))}
                </Card>}

                {r.algorithmSignals&&<Card>
                  <Lbl color={C.accent}>Algorithm Signals</Lbl>
                  {Object.entries(r.algorithmSignals).map(([k,v])=><Row key={k} icon="◆" label={k.replace(/([A-Z])/g," $1").trim()} value={v} color={C.accent}/>)}
                </Card>}

                <Card>
                  <Lbl color={C.red}>Retention Killers</Lbl>
                  {(r.retentionKillers||[]).map((k,i)=><Row key={i} icon="✕" value={k} color={C.red}/>)}
                  <div style={{height:1,background:C.border,margin:"10px 0"}}/>
                  <Lbl color={C.green}>Retention Boosts</Lbl>
                  {(r.retentionBoosts||[]).map((b,i)=><Row key={i} icon="✓" value={b} color={C.green}/>)}
                </Card>

                {r.fixBeforePosting&&<Card accent={C.amber}>
                  <Lbl color={C.amber}>Fix Before Posting</Lbl>
                  {r.fixBeforePosting.map((f,i)=><Row key={i} icon={`${i+1}.`} value={f}/>)}
                </Card>}

                <Card glow>
                  <Lbl color={C.green}>Rewritten Hook — 3x Stronger</Lbl>
                  <div style={{fontSize:15,fontWeight:800,color:C.text,background:C.surface,borderRadius:8,padding:"13px 15px",marginBottom:13,fontStyle:"italic"}}>"{r.rewrittenHook}"</div>
                  <Lbl color={C.pink}>Optimized Caption</Lbl>
                  <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8,background:C.surface,borderRadius:8,padding:"12px 14px",marginBottom:13}}>{r.rewrittenCaption}</div>
                  <Lbl color={C.blue}>Best Time to Post</Lbl>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{r.bestTimeToPost}</div>
                </Card>

                <Card>
                  <Lbl color={C.accent}>How to Reshoot for 1M Views</Lbl>
                  <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8}}>{r.viralVersion}</div>
                </Card>

                {r.strategyNote&&<Card glow>
                  <Lbl color={C.accent}>Growth Strategy (Claude)</Lbl>
                  <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:13}}>{r.strategyNote}</div>
                  {r.nextThreeVideos&&<><Lbl color={C.green}>Make These Next</Lbl>{r.nextThreeVideos.map((v,i)=><Row key={i} icon={`${i+1}.`} value={v}/>)}</>}
                  {r.algorithmPlay&&<><div style={{height:1,background:C.border,margin:"10px 0"}}/><Lbl color={C.amber}>Algorithm Play You're Missing</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.algorithmPlay}</div></>}
                  {r.growthTrajectory&&<><div style={{height:1,background:C.border,margin:"10px 0"}}/><Lbl color={C.blue}>Growth Trajectory</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.growthTrajectory}</div></>}
                </Card>}

                {r.competitorAngle&&<Card><Lbl color={C.pink}>How a Top Creator Would Do This</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.competitorAngle}</div></Card>}
              </>;
            })()}
            {predResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{predResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ DEEP DIVE ══ */}
        {tab==="deepdive"&&(
          <div>
            <Card glow>
              <Lbl color={C.accent}>🧠 Algorithm Deep Dive</Lbl>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:6}}>The full algorithm breakdown. Second-by-second viewer psychology + algorithm signals. Upload a video, paste a URL, or describe it.</div>
            </Card>
            <Card>
              <MediaInput label="Video to Analyze" urlVal={deepUrl} onUrlChange={setDeepUrl} file={deepFile} preview={deepPreview} onFile={f=>{setDeepFile(f);setDeepPreview(URL.createObjectURL(f));setDeepResult(null);}} onClear={()=>{setDeepFile(null);setDeepPreview("");}} urlPlaceholder="https://www.tiktok.com/@username/video/..."/>
              <div style={{marginBottom:12}}>
                <Lbl>Or describe the video</Lbl>
                <TIn placeholder="Describe your video in detail — what you said, how you opened, what happened, the vibe..." value={deepText} onChange={e=>setDeepText(e.target.value)} rows={3}/>
              </div>
              <Btn onClick={runDeepDive} disabled={loading||!gSaved||(!deepUrl&&!deepFile&&!deepText)} full>Run Algorithm Deep Dive 🧠</Btn>
            </Card>

            {deepResult&&!deepResult.raw&&(()=>{
              const r=deepResult;
              const vc=r.verdict?.includes("POST NOW")?C.green:r.verdict?.includes("RESHOOT")?C.amber:C.red;
              return<>
                <Card glow accent={vc}>
                  <div style={{textAlign:"center",marginBottom:14}}>
                    <div style={{fontSize:20,fontWeight:900,color:vc,marginBottom:4}}>{r.verdict}</div>
                    <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:4}}>{r.viralProbability}</div>
                    <div style={{fontSize:12,color:C.muted}}>Grade: <b style={{color:vc,fontSize:14}}>{r.algorithmGrade}</b> · Completion est: <b style={{color:C.text}}>{r.completionRateEstimate}</b></div>
                  </div>
                  <Bar label="Algorithm Score" score={r.algorithmScore} color={C.accent}/>
                  <Bar label="Viewer Score" score={r.viewerScore} color={C.green}/>
                  <Bar label="Hook" score={r.hookScore} color={C.amber}/>
                  <Bar label="Retention" score={r.retentionScore} color={C.pink}/>
                  <Bar label="Shareability" score={r.shareabilityScore} color="#FF9F47"/>
                  <Bar label="Loop Potential" score={r.loopScore} color={C.blue}/>
                  <Bar label="Comment Bait" score={r.commentBaitScore} color={C.pink}/>
                </Card>

                {deepResult.engagement&&<Card>
                  <Lbl color={C.amber}>Real Stats</Lbl>
                  <div style={{fontSize:13,color:"#C8CAE0",background:C.surface,borderRadius:8,padding:"9px 12px",marginBottom:10}}>{deepResult.engagement.desc||"No caption"}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
                    <Stat label="Views" value={fmt(deepResult.engagement.playCount)} color={C.accent}/>
                    <Stat label="Likes" value={fmt(deepResult.engagement.diggCount)} color={C.pink}/>
                    <Stat label="Comments" value={fmt(deepResult.engagement.commentCount)} color={C.green}/>
                    <Stat label="Shares" value={fmt(deepResult.engagement.shareCount)} color={C.amber}/>
                  </div>
                </Card>}

                {r.algorithmReport&&<Card>
                  <Lbl color={C.accent}>Algorithm Report</Lbl>
                  {Object.entries(r.algorithmReport).map(([k,v])=><Row key={k} icon="◆" label={k.replace(/([A-Z])/g," $1").trim()} value={v}/>)}
                </Card>}

                {r.viewerPsychology&&<Card>
                  <Lbl color={C.green}>Viewer Psychology</Lbl>
                  {Object.entries(r.viewerPsychology).map(([k,v])=>(
                    <div key={k} style={{background:C.surface,borderRadius:8,padding:"9px 12px",marginBottom:8}}>
                      <div style={{fontSize:9,color:C.green,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:3}}>{k.replace(/([A-Z])/g," $1").trim()}</div>
                      <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.5}}>{v}</div>
                    </div>
                  ))}
                </Card>}

                {r.secondBySecond&&<Card>
                  <Lbl color={C.amber}>Second-by-Second Breakdown</Lbl>
                  {r.secondBySecond.map((s,i)=>{
                    const c=[C.green,C.accent,C.amber,C.pink][i%4];
                    return<div key={i} style={{background:C.surface,borderRadius:10,padding:"11px 13px",marginBottom:9,borderLeft:`3px solid ${c}`}}>
                      <Chip color={c}>{s.timestamp}</Chip>
                      <div style={{fontSize:12,color:C.muted,marginTop:6,marginBottom:4}}>📹 {s.what}</div>
                      <div style={{fontSize:12,color:C.green,marginBottom:4}}>👁 Viewer: "{s.viewerReaction}"</div>
                      <div style={{fontSize:12,color:C.accent}}>⚡ Algorithm: {s.algorithmSignal}</div>
                    </div>;
                  })}
                </Card>}

                <Card>
                  <Lbl color={C.red}>Hook Autopsy</Lbl>
                  <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:12}}>{r.hookAutopsy}</div>
                  <Lbl color={C.green}>Rewritten Hook</Lbl>
                  <div style={{fontSize:15,fontWeight:800,color:C.text,background:C.surface,borderRadius:8,padding:"12px 14px",fontStyle:"italic"}}>"{r.rewrittenHook}"</div>
                </Card>

                <Card>
                  <Lbl color={C.red}>Retention Killers</Lbl>
                  {(r.retentionKillers||[]).map((k,i)=><Row key={i} icon="✕" value={k} color={C.red}/>)}
                  <div style={{height:1,background:C.border,margin:"10px 0"}}/>
                  <Lbl color={C.green}>Retention Boosts</Lbl>
                  {(r.retentionBoosts||[]).map((b,i)=><Row key={i} icon="✓" value={b} color={C.green}/>)}
                </Card>

                {r.algorithmFixes&&<Card accent={C.amber}>
                  <Lbl color={C.amber}>Algorithm Fixes</Lbl>
                  {r.algorithmFixes.map((f,i)=><Row key={i} icon={`${i+1}.`} value={f}/>)}
                </Card>}

                <Card glow>
                  <Lbl color={C.accent}>How to Reshoot for 1M Views</Lbl>
                  <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8,marginBottom:13}}>{r.viralVersion}</div>
                  <Lbl color={C.pink}>Optimized Caption</Lbl>
                  <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8,background:C.surface,borderRadius:8,padding:"12px 14px",marginBottom:13}}>{r.rewrittenCaption}</div>
                  <Lbl color={C.blue}>Best Time to Post</Lbl>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{r.optimalPostTime}</div>
                </Card>

                {r.competitorAngle&&<Card><Lbl color={C.pink}>How a Top Creator Would Do This</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.competitorAngle}</div></Card>}
              </>;
            })()}
            {deepResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{deepResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ PROFILE ══ */}
        {tab==="profile"&&(
          <div>
            <Card glow>
              <Lbl color={C.accent}>Profile Deep Dive</Lbl>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:13}}>Paste any TikTok profile URL. Apify pulls all videos automatically — AI analyzes cold with zero assumptions.</div>
              <div style={{marginBottom:10}}><TIn placeholder="https://www.tiktok.com/@username or @username" value={profHandle} onChange={e=>setProfHandle(e.target.value)}/></div>
              <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:7}}>Videos to Analyze</div>
              <div style={{display:"flex",gap:7,marginBottom:13}}>
                {[10,20,30].map(n=><button key={n} onClick={()=>setProfCount(n)} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${profCount===n?C.accent:C.border}`,background:profCount===n?C.accent+"18":"transparent",color:profCount===n?C.accent:C.muted,fontSize:12,cursor:"pointer",fontWeight:profCount===n?700:400}}>Last {n}</button>)}
              </div>
              <Btn onClick={runProfile} disabled={loading||!aSaved||!gSaved||!profHandle} full>Analyze This Profile 👤</Btn>
            </Card>

            {profResult&&!profResult.raw&&(()=>{
              const r=profResult;const s=r.stats;
              return<>
                <Card>
                  <Lbl color={C.amber}>Real Stats — Last {r.count} Videos</Lbl>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:11}}>
                    <Stat label="Total Views" value={fmt(s.totalViews)} color={C.accent}/>
                    <Stat label="Avg Views" value={fmt(s.avgViews)} color={C.blue}/>
                    <Stat label="Total Likes" value={fmt(s.totalLikes)} color={C.pink}/>
                    <Stat label="Eng Rate" value={s.avgEng?s.avgEng+"%":"—"} color={C.green}/>
                  </div>
                  <div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>{r.avgViewsRead}</div>
                </Card>
                <Card glow>
                  <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                    <div style={{width:52,height:52,borderRadius:12,background:`linear-gradient(135deg,${C.accent},#B06FFF)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:900,flexShrink:0,color:"#fff"}}>{r.overallGrade}</div>
                    <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6,flex:1}}>{r.executiveSummary}</div>
                  </div>
                  <Bar label="Channel Health" score={r.channelHealth} color={C.accent}/>
                  <Bar label="Consistency" score={r.consistencyScore} color={C.green}/>
                  <Bar label="Hook Strength" score={r.hookStrengthAvg} color={C.amber}/>
                  <Bar label="Engagement" score={r.engagementScore} color={C.pink}/>
                  <Bar label="Growth Momentum" score={r.growthMomentum} color="#FF9F47"/>
                </Card>
                <Card>
                  <Lbl color={C.green}>Top 5 Videos</Lbl>
                  {r.top5.map((v,i)=>(
                    <div key={i} style={{background:C.surface,borderRadius:10,padding:"11px 13px",marginBottom:8}}>
                      <div style={{display:"flex",gap:9,marginBottom:6,alignItems:"flex-start"}}>
                        <div style={{minWidth:20,height:20,borderRadius:5,background:C.green+"25",color:C.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,flexShrink:0}}>#{i+1}</div>
                        <div style={{fontSize:12,color:"#C8CAE0",lineHeight:1.5,flex:1}}>{v.desc||"No caption"}</div>
                      </div>
                      <div style={{display:"flex",gap:11,paddingLeft:29}}>
                        <span style={{fontSize:11,color:C.accent}}>👁 {fmt(v.playCount)}</span>
                        <span style={{fontSize:11,color:C.pink}}>❤️ {fmt(v.diggCount)}</span>
                        <span style={{fontSize:11,color:C.amber}}>↗️ {fmt(v.shareCount)}</span>
                        <span style={{fontSize:11,color:C.muted}}>{v.video?.duration}s</span>
                      </div>
                    </div>
                  ))}
                </Card>
                <Card>
                  <Lbl color={C.red}>Bottom 5 — Study These</Lbl>
                  {r.bottom5.map((v,i)=>(
                    <div key={i} style={{background:C.surface,borderRadius:10,padding:"11px 13px",marginBottom:8}}>
                      <div style={{display:"flex",gap:9,marginBottom:6,alignItems:"flex-start"}}>
                        <div style={{minWidth:20,height:20,borderRadius:5,background:C.red+"25",color:C.red,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,flexShrink:0}}>↓</div>
                        <div style={{fontSize:12,color:"#C8CAE0",lineHeight:1.5,flex:1}}>{v.desc||"No caption"}</div>
                      </div>
                      <div style={{display:"flex",gap:11,paddingLeft:29}}>
                        <span style={{fontSize:11,color:C.accent}}>👁 {fmt(v.playCount)}</span>
                        <span style={{fontSize:11,color:C.pink}}>❤️ {fmt(v.diggCount)}</span>
                        <span style={{fontSize:11,color:C.muted}}>{v.video?.duration}s</span>
                      </div>
                    </div>
                  ))}
                </Card>
                <Card><Lbl color={C.green}>What's Working</Lbl>{(r.topPatterns||[]).map((p,i)=><Row key={i} icon="✓" value={p} color={C.green}/>)}<div style={{height:1,background:C.border,margin:"10px 0"}}/><Lbl color={C.red}>What's Flopping</Lbl>{(r.floppingPatterns||[]).map((p,i)=><Row key={i} icon="✕" value={p} color={C.red}/>)}</Card>
                <Card><Lbl color={C.amber}>Hidden Strength</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:13}}>{r.hiddenStrength}</div><Lbl color={C.red}>Biggest Leak</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.biggestLeak}</div></Card>
                <Card><Lbl color={C.accent}>Content Gaps</Lbl>{(r.contentGaps||[]).map((g,i)=><Row key={i} icon="◆" value={g}/>)}</Card>
                <Card glow><Lbl color={C.green}>Double Down On This</Lbl><div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:13,lineHeight:1.6}}>{r.doubleDown}</div><Lbl color={C.red}>Drop This Immediately</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.dropImmediately}</div></Card>
                <Card><Lbl color={C.amber}>Your Next 30 Days</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8}}>{r.next30Days}</div></Card>
                <Card glow><Lbl color={C.accent}>Path to 2M</Lbl><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.7,fontStyle:"italic"}}>"{r.pathTo2M}"</div></Card>
              </>;
            })()}
            {profResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{profResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ COMPETITOR ══ */}
        {tab==="competitor"&&(
          <div>
            <Card>
              <MediaInput label="Competitor Video" urlVal={compUrl} onUrlChange={setCompUrl} file={compFile} preview={compPreview} onFile={f=>{setCompFile(f);setCompPreview(URL.createObjectURL(f));setCompResult(null);}} onClear={()=>{setCompFile(null);setCompPreview("");}} urlPlaceholder="https://www.tiktok.com/@username/video/..."/>
              <Btn onClick={runComp} disabled={loading||!gSaved||(!compUrl&&!compFile)} full>Reverse Engineer ⚡</Btn>
            </Card>
            {compResult&&!compResult.raw&&(()=>{
              const r=compResult;
              return<>
                {r.engagement&&<Card>
                  <Lbl color={C.amber}>Live Stats</Lbl>
                  <div style={{fontSize:13,color:"#C8CAE0",background:C.surface,borderRadius:8,padding:"9px 12px",marginBottom:11}}>{r.engagement.desc||"No caption"}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
                    <Stat label="Views" value={fmt(r.engagement.playCount)} color={C.accent}/>
                    <Stat label="Likes" value={fmt(r.engagement.diggCount)} color={C.pink}/>
                    <Stat label="Comments" value={fmt(r.engagement.commentCount)} color={C.green}/>
                    <Stat label="Shares" value={fmt(r.engagement.shareCount)} color={C.amber}/>
                  </div>
                </Card>}
                <Card glow>
                  <div style={{fontSize:15,fontWeight:900,marginBottom:7}}>{r.title}</div>
                  <div style={{marginBottom:13}}>{(r.tags||[]).map(t=><Chip key={t}>{t}</Chip>)}</div>
                  <Bar label="Viral Score" score={r.viralScore} color={C.accent}/>
                  <Bar label="Hook" score={r.hookScore} color={C.green}/>
                  <Bar label="Retention" score={r.retentionScore} color={C.amber}/>
                  <Bar label="Shareability" score={r.shareabilityScore} color={C.pink}/>
                  <Bar label="Emotional Pull" score={r.emotionScore} color="#FF9F47"/>
                </Card>
                <Card><Lbl color={C.green}>Hook Breakdown</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.hookBreakdown}</div></Card>
                <Card><Lbl>Structure</Lbl>{(r.structure||[]).map((b,i)=><Row key={i} icon={i+1} value={b}/>)}</Card>
                <Card><Lbl color={C.green}>Why It Works</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:9}}>{r.whyItWorks}</div><Chip color={C.green}>{r.emotionalDriver}</Chip></Card>
                <Card><Lbl color={C.amber}>Steal These</Lbl>{(r.steal||[]).map((s,i)=><Row key={i} icon="→" value={s} color={C.green}/>)}{(r.avoid||[]).length>0&&<><div style={{height:1,background:C.border,margin:"10px 0"}}/><Lbl color={C.red}>Skip These</Lbl>{r.avoid.map((s,i)=><Row key={i} icon="✕" value={s} color={C.red}/>)}</>}</Card>
                <Card glow><Lbl>The Formula</Lbl><div style={{fontSize:14,fontWeight:700,color:C.text,fontStyle:"italic"}}>"{r.formula}"</div></Card>
              </>;
            })()}
            {compResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{compResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ SCRIPT ══ */}
        {tab==="script"&&(
          <div>
            <Card>
              <Lbl>What's the video about?</Lbl>
              <div style={{marginBottom:11}}><TIn placeholder="e.g. The reality of having a gay son..." value={scriptTopic} onChange={e=>setScriptTopic(e.target.value)}/></div>
              <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:7}}>Content Angle</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:13}}>
                {[["mother-son","Mother-Son 🤝"],["travel","Travel ✈️"],["reaction","Reaction 😂"],["lifestyle","Lifestyle 🎯"],["brand","Brand Deal 💰"]].map(([id,label])=>(
                  <button key={id} onClick={()=>setScriptAngle(id)} style={{padding:"6px 11px",borderRadius:8,border:`1px solid ${scriptAngle===id?C.accent:C.border}`,background:scriptAngle===id?C.accent+"18":"transparent",color:scriptAngle===id?C.accent:C.muted,fontSize:12,cursor:"pointer",fontWeight:scriptAngle===id?700:400}}>{label}</button>
                ))}
              </div>
              <Btn onClick={runScript} disabled={loading||!scriptTopic||!gSaved} full>Generate Script ✍️</Btn>
            </Card>
            {scriptResult&&!scriptResult.raw&&(()=>{
              const r=scriptResult;
              return<>
                <Card glow>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{fontSize:15,fontWeight:900,flex:1,marginRight:11}}>{r.title}</div>
                    <div style={{fontSize:24,fontWeight:900,color:C.accent,lineHeight:1}}>{r.viralPotential}<span style={{fontSize:11,color:C.muted}}>/10</span></div>
                  </div>
                  <div style={{fontSize:12,color:C.muted,marginTop:7,lineHeight:1.6}}>{r.whyItWillWork}</div>
                </Card>
                <Card><Lbl color={C.green}>Opening Hook</Lbl><div style={{fontSize:15,fontWeight:800,color:C.text,marginBottom:6}}>"{r.hook}"</div><div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>{r.whyThisHook}</div></Card>
                <Card>
                  <Lbl>Shot-by-Shot Script</Lbl>
                  {(r.script||[]).map((beat,i)=>{
                    const bc=[C.green,C.accent,C.amber,C.pink,C.accent][i%5];
                    return<div key={i} style={{background:C.surface,borderRadius:10,padding:"11px 13px",marginBottom:9,borderLeft:`3px solid ${i===0?C.green:i===(r.script.length-1)?C.accent:C.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><Chip color={bc}>{beat.beat}</Chip><span style={{fontSize:10,color:C.muted}}>{beat.duration}</span></div>
                      {beat.action&&<div style={{fontSize:11,color:C.muted,marginBottom:4}}>📹 {beat.action}</div>}
                      {beat.dialogue&&<div style={{fontSize:13,color:C.text,fontStyle:"italic"}}>"{beat.dialogue}"</div>}
                    </div>;
                  })}
                </Card>
                <Card><Lbl color={C.amber}>Visual Direction</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:13}}>{r.visualDirection}</div><Lbl color={C.amber}>Sound Strategy</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.soundStrategy}</div></Card>
                <Card><Lbl color={C.pink}>Caption</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8,background:C.surface,borderRadius:8,padding:"11px 13px"}}>{r.caption}</div></Card>
              </>;
            })()}
            {scriptResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{scriptResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ ANALYZE ME ══ */}
        {tab==="analyze"&&(
          <div>
            <Card>
              <MediaInput label="Your Video" urlVal={myUrl} onUrlChange={setMyUrl} file={myFile} preview={myPreview} onFile={f=>{setMyFile(f);setMyPreview(URL.createObjectURL(f));setMyResult(null);}} onClear={()=>{setMyFile(null);setMyPreview("");}} urlPlaceholder="https://www.tiktok.com/@username/video/..."/>
              <div style={{marginBottom:11}}>
                <Lbl>Or describe your video</Lbl>
                <TIn placeholder="What happened, what you said, how it performed, what felt off..." value={myText} onChange={e=>setMyText(e.target.value)} rows={3}/>
              </div>
              <Btn onClick={runAnalyze} disabled={loading||!gSaved||(!myUrl&&!myFile&&!myText)} full>Analyze My Video 🔬</Btn>
            </Card>
            {myResult&&!myResult.raw&&(()=>{
              const r=myResult;
              return<>
                {r.engagement&&<Card>
                  <Lbl color={C.amber}>Your Stats</Lbl>
                  <div style={{fontSize:13,color:"#C8CAE0",background:C.surface,borderRadius:8,padding:"9px 12px",marginBottom:11}}>{r.engagement.desc||"No caption"}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:r.numbersRead?11:0}}>
                    <Stat label="Views" value={fmt(r.engagement.playCount)} color={C.accent}/>
                    <Stat label="Likes" value={fmt(r.engagement.diggCount)} color={C.pink}/>
                    <Stat label="Comments" value={fmt(r.engagement.commentCount)} color={C.green}/>
                    <Stat label="Shares" value={fmt(r.engagement.shareCount)} color={C.amber}/>
                  </div>
                  {r.numbersRead&&<div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>{r.numbersRead}</div>}
                </Card>}
                <Card glow><Lbl>Performance</Lbl><Bar label="Overall" score={r.overallScore} color={C.accent}/><Bar label="Hook" score={r.hookScore} color={C.green}/><Bar label="Retention" score={r.retentionScore} color={C.amber}/><Bar label="Brand" score={r.brandScore} color={C.pink}/><Bar label="Growth Potential" score={r.growthScore} color="#FF9F47"/></Card>
                <Card><Lbl color={C.green}>What Worked</Lbl>{(r.whatWorked||[]).map((w,i)=><Row key={i} icon="✓" value={w} color={C.green}/>)}</Card>
                <Card><Lbl color={C.red}>What Missed</Lbl>{(r.whatMissed||[]).map((w,i)=><Row key={i} icon="✕" value={w} color={C.red}/>)}</Card>
                <Card><Lbl color={C.amber}>The Breakthrough Move</Lbl><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.6}}>{r.breakthroughMove}</div></Card>
                <Card><Lbl>Pattern Insight</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:13}}>{r.patternInsight}</div><Lbl color={C.green}>Make This Next</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.nextVideo}</div></Card>
                <Card glow><Lbl color={C.accent}>Direct Note</Lbl><div style={{fontSize:14,color:C.text,lineHeight:1.8,fontStyle:"italic"}}>"{r.directNote}"</div></Card>
              </>;
            })()}
            {myResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{myResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ STRATEGY ══ */}
        {tab==="strategy"&&(
          <div>
            <Card glow><Lbl color={C.accent}>Growth Strategy</Lbl><div style={{fontSize:13,color:C.muted,marginBottom:13}}>{profResult?"Built from your real profile data.":"Run Profile Analysis first for data-driven strategy."}</div><Btn onClick={runStrat} disabled={loading||!gSaved} full>Build My Strategy 🧭</Btn></Card>
            {stratResult&&!stratResult.raw&&(()=>{
              const r=stratResult;
              return<>
                <Card glow><Lbl color={C.accent}>Core Identity</Lbl><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.6,marginBottom:13}}>{r.coreIdentity}</div><Lbl color={C.green}>Biggest Asset</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.biggestAsset}</div></Card>
                <Card><Lbl>Niche Opportunities</Lbl>
                  {(r.niches||[]).map((n,i)=>(
                    <div key={i} style={{background:C.surface,borderRadius:11,padding:"13px 15px",marginBottom:11,borderLeft:`3px solid ${[C.accent,C.green,C.amber,C.pink][i%4]}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><div style={{fontSize:13,fontWeight:800,color:C.text}}>{n.name}</div><Chip color={n.difficulty==="Easy"?C.green:n.difficulty==="Medium"?C.amber:C.red}>{n.difficulty}</Chip></div>
                      <Row icon="💡" label="Why you" value={n.why}/>
                      <Row icon="🎯" label="Your angle" value={n.howToWin} color={C.green}/>
                      <Row icon="⚡" label="Why now" value={n.urgency} color={C.amber}/>
                    </div>
                  ))}
                </Card>
                <Card glow><Lbl color={C.green}>Top Pick</Lbl><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.6}}>{r.topNiche}</div></Card>
                <Card><Lbl color={C.amber}>Revenue Angles</Lbl>{(r.revenueAngles||[]).map((a,i)=><Row key={i} icon="💰" value={a} color={C.pink}/>)}</Card>
                <Card><Lbl>Roadmap</Lbl>{(r.milestoneRoadmap||[]).map((m,i)=><div key={i} style={{display:"flex",gap:11,marginBottom:11,alignItems:"flex-start"}}><div style={{minWidth:52,padding:"3px 7px",borderRadius:6,background:[C.accent,C.green,C.amber][i]+"25",color:[C.accent,C.green,C.amber][i],fontSize:9,fontWeight:800,textAlign:"center",flexShrink:0}}>{["1M","2M","5M"][i]}</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6,paddingTop:2}}>{m}</div></div>)}</Card>
                <Card accent={C.red}><Lbl color={C.red}>Hard Truth</Lbl><div style={{fontSize:14,fontWeight:600,color:C.text,lineHeight:1.7,fontStyle:"italic"}}>"{r.hardTruth}"</div></Card>
              </>;
            })()}
            {stratResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{stratResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ BRAND ══ */}
        {tab==="brand"&&(
          <div>
            <Card glow><Lbl color={C.accent}>Brand Identity</Lbl><div style={{fontSize:13,color:C.muted,marginBottom:13}}>{profResult?"Built from your actual content.":"Run Profile Analysis first for data-driven brand identity."}</div><Btn onClick={runBrand} disabled={loading||!gSaved} full>Define My Brand ⭐</Btn></Card>
            {brandResult&&!brandResult.raw&&(()=>{
              const r=brandResult;
              return<>
                <Card glow><Lbl color={C.accent}>Brand Statement</Lbl><div style={{fontSize:15,fontWeight:800,color:C.text,lineHeight:1.5,marginBottom:13}}>{r.brandStatement}</div><Lbl color={C.green}>Tagline</Lbl><div style={{fontSize:20,fontWeight:900,color:C.green}}>{r.tagline}</div></Card>
                <Card><Lbl>Core Values</Lbl>{(r.coreValues||[]).map((v,i)=><Row key={i} icon="◆" value={v}/>)}</Card>
                <Card><Lbl color={C.blue}>Audience</Lbl><Row icon="👥" label="Now" value={r.audience?.primary}/><Row icon="🎯" label="Next" value={r.audience?.aspirational} color={C.accent}/><Row icon="🧠" label="Mindset" value={r.audience?.psychographic}/></Card>
                <Card><Lbl>Content Pillars</Lbl>{(r.contentPillars||[]).map((p,i)=>{const c=[C.accent,C.green,C.amber,C.pink][i%4];return<div key={i} style={{display:"flex",gap:11,marginBottom:11,alignItems:"flex-start"}}><div style={{minWidth:40,padding:"3px 6px",borderRadius:6,background:c+"25",color:c,fontSize:9,fontWeight:800,textAlign:"center",flexShrink:0}}>{p.percentage}</div><div><div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:2}}>{p.pillar}</div><div style={{fontSize:11,color:C.muted,lineHeight:1.5}}>{p.description}</div></div></div>;})}</Card>
                <Card glow><Lbl color={C.green}>What Makes You Different</Lbl><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.6,marginBottom:13}}>{r.whatMakesDifferent}</div><Lbl color={C.red}>Stop Doing This</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.whatToStop}</div></Card>
                <Card glow><Lbl color={C.accent}>At 5M — The Vision</Lbl><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.7,fontStyle:"italic"}}>"{r.northStar}"</div></Card>
              </>;
            })()}
            {brandResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{brandResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ CALENDAR ══ */}
        {tab==="calendar"&&(
          <div>
            <Card>
              <Lbl>7-Day Content Calendar</Lbl>
              <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:7}}>Focus</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:13}}>
                {[["mixed","Balanced"],["mother-son","Mother-Son 🤝"],["travel","Travel ✈️"],["growth","Max Growth 📈"],["brand","Brand Deals 💰"]].map(([id,label])=>(
                  <button key={id} onClick={()=>setCalFocus(id)} style={{padding:"6px 11px",borderRadius:8,border:`1px solid ${calFocus===id?C.accent:C.border}`,background:calFocus===id?C.accent+"18":"transparent",color:calFocus===id?C.accent:C.muted,fontSize:12,cursor:"pointer",fontWeight:calFocus===id?700:400}}>{label}</button>
                ))}
              </div>
              <Btn onClick={runCal} disabled={loading||!gSaved} full>Generate My Week 📅</Btn>
            </Card>
            {calResult&&!calResult.raw&&(()=>{
              const r=calResult;
              return<>
                <Card glow><Lbl color={C.accent}>This Week</Lbl><div style={{fontSize:15,fontWeight:800,color:C.text,marginBottom:9}}>{r.weekTheme}</div><Lbl color={C.green}>Hero Video</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.heroVideo}</div></Card>
                {(r.days||[]).map((d,i)=>{
                  const c=[C.accent,C.green,C.amber,C.pink,C.blue,C.accent,C.green][i];
                  return<div key={i} style={{background:C.card,borderRadius:13,border:`1px solid ${C.border}`,padding:"15px",marginBottom:11}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
                      <div style={{fontSize:12,fontWeight:800,color:c}}>{d.day}</div>
                      <div style={{display:"flex",gap:6}}><Chip color={ec(d.effort)}>{d.effort}</Chip><span style={{fontSize:10,color:C.muted}}>{d.viralPotential}/10 🔥</span></div>
                    </div>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:5}}>{d.concept}</div>
                    <div style={{fontSize:12,color:C.muted,marginBottom:5,fontStyle:"italic"}}>Hook: "{d.hook}"</div>
                    <div style={{display:"flex",justifyContent:"space-between"}}><Chip color={c}>{d.angle}</Chip><span style={{fontSize:10,color:C.dim}}>{d.notes}</span></div>
                  </div>;
                })}
                <Card><Lbl color={C.amber}>Repurpose Tip</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.repurposeTip}</div></Card>
              </>;
            })()}
            {calResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{calResult.raw}</div></Card>}
          </div>
        )}

        {/* ══ UNBLOCK ══ */}
        {tab==="unblock"&&(
          <div>
            <Card glow>
              <Lbl color={C.accent}>Creative Unblock</Lbl>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:13}}>Tell me what you're feeling — or leave blank. No judgment. Just clarity.</div>
              <div style={{marginBottom:11}}><TIn placeholder="e.g. I don't know what to post, everything feels the same, I'm scared my next video flops..." value={blockText} onChange={e=>setBlockText(e.target.value)} rows={3}/></div>
              <Btn onClick={runUnblock} disabled={loading||!gSaved} full color={C.pink}>Break Through My Block 💡</Btn>
            </Card>
            {unblockResult&&!unblockResult.raw&&(()=>{
              const r=unblockResult;
              return<>
                <Card glow accent={C.pink}><Lbl color={C.pink}>What Your Block Is Telling You</Lbl><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.7,marginBottom:13}}>{r.reframe}</div><Lbl color={C.muted}>Root Cause</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.rootCause}</div></Card>
                <Card glow accent={C.green}><Lbl color={C.green}>Do This Today</Lbl><div style={{fontSize:15,fontWeight:700,color:C.text,lineHeight:1.6}}>{r.immediateAction}</div></Card>
                <Card>
                  <Lbl color={C.accent}>6 Ideas Ready to Film</Lbl>
                  {(r.ideas||[]).map((idea,i)=>{
                    const c=[C.accent,C.green,C.amber,C.pink,C.blue,C.accent][i];
                    return<div key={i} style={{background:C.surface,borderRadius:11,padding:"13px 15px",marginBottom:9,borderLeft:`3px solid ${c}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.text,flex:1,marginRight:9}}>{idea.title}</div>
                        <div style={{display:"flex",gap:5,flexShrink:0}}><Chip color={ec(idea.effort)}>{idea.effort}</Chip><span style={{fontSize:10,color:C.muted,paddingTop:3}}>{idea.viralPotential}/10</span></div>
                      </div>
                      <div style={{fontSize:12,color:C.muted,fontStyle:"italic",marginBottom:4}}>"{idea.hook}"</div>
                      <div style={{fontSize:11,color:c}}>{idea.whyNow}</div>
                    </div>;
                  })}
                </Card>
                <Card><Lbl color={C.amber}>Mindset Shift</Lbl><div style={{fontSize:14,fontWeight:600,color:C.text,lineHeight:1.7,marginBottom:13}}>{r.mindsetShift}</div><Lbl color={C.green}>Remember This</Lbl><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.reminder}</div></Card>
                <Card glow><Lbl color={C.accent}>Your Next Step</Lbl><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.6}}>{r.nextStep}</div></Card>
              </>;
            })()}
            {unblockResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{unblockResult.raw}</div></Card>}
          </div>
        )}

      </div>
    </div>
  );
}
