import { useState, useRef } from "react";

const APP_PASSWORD = "aldavincii2M";

const CREATOR = `
Name: Antonio (@aldavincii), Age: 23, Platform: TikTok/Instagram/YouTube
Followers: Approaching 1M, Location: Baltimore MD
Content: Mother-son dynamic (strongest), spontaneous travel, comedy/reaction
Brand deals: Amazon, Netflix, Paramount, Lionsgate, Universal
Business: The Grand Agency LLC, Signal Alliance Group LLC
Goals: Scale past 1M, define brand identity, overcome creative blocks
Strengths: Authentic mother-son chemistry, film/TV background, major entertainment relationships
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
  const res=await fetch("/api/apify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,body:{postURLs:[url],resultsPerPage:1,shouldDownloadVideos:false,shouldDownloadCovers:false}})});
  const d=await res.json();
  if(!d||!d.length)throw new Error("Apify returned no data.");
  return d[0];
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

function TextInput({placeholder,value,onChange,type="text",rows}){
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
        <TextInput type={vis?"text":"password"} placeholder={hint} value={value} onChange={e=>onChange(e.target.value)}/>
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

  // Profile
  const [profileHandle,setProfileHandle]=useState("https://www.tiktok.com/@aldavincii");
  const [profileCount,setProfileCount]=useState(20);
  const [profileResult,setProfileResult]=useState(null);

  // Predict
  const predictRef=useRef(null);
  const [predictFile,setPredictFile]=useState(null);
  const [predictPreview,setPredictPreview]=useState("");
  const [predictResult,setPredictResult]=useState(null);

  // Competitor
  const [compUrl,setCompUrl]=useState("");
  const [compResult,setCompResult]=useState(null);

  // Script
  const [scriptTopic,setScriptTopic]=useState("");
  const [scriptAngle,setScriptAngle]=useState("mother-son");
  const [scriptResult,setScriptResult]=useState(null);

  // Analyze
  const [myUrl,setMyUrl]=useState("");
  const [myMode,setMyMode]=useState("url");
  const [myText,setMyText]=useState("");
  const [myResult,setMyResult]=useState(null);

  // Strategy
  const [strategyResult,setStrategyResult]=useState(null);

  // Brand
  const [brandResult,setBrandResult]=useState(null);

  // Calendar
  const [calFocus,setCalFocus]=useState("mixed");
  const [calResult,setCalResult]=useState(null);

  // Unblock
  const [blockFeeling,setBlockFeeling]=useState("");
  const [unblockResult,setUnblockResult]=useState(null);

  const run=async(fn)=>{setError("");setLoading(true);try{await fn();}catch(e){setError(e.message);}setLoading(false);setLoadMsg("");};

  const runProfile=()=>run(async()=>{
    if(!apifySaved)throw new Error("Apify token required.");
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    setLoadMsg(`Pulling your last ${profileCount} videos...`);
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
    setLoadMsg("AI analyzing your patterns...");
    const raw=await claude(
      `Senior creator analyst. Analyze ${videos.length} TikTok videos. Creator: ${CREATOR}. Return ONLY JSON in \`\`\`json blocks: {"overallGrade":"A-D","channelHealth":1-10,"consistencyScore":1-10,"hookStrengthAvg":1-10,"engagementScore":1-10,"growthMomentum":1-10,"executiveSummary":"2-3 sentences","topPatterns":["p1","p2","p3"],"floppingPatterns":["p1","p2"],"bestContentType":"type","worstContentType":"type","avgViewsRead":"1 sentence","hiddenStrength":"insight","biggestLeak":"insight","contentGaps":["gap1","gap2","gap3"],"doubleDown":"what to post 3x more","dropImmediately":"what to stop","next30Days":"action plan","pathTo2M":"realistic path"}`,
      `Videos: ${videos.length}, Total views: ${fmt(totalViews)}, Avg views: ${fmt(avgViews)}, Engagement: ${avgEngagement?avgEngagement+"%":"N/A"}, Followers: ${fmt(videos[0]?.authorMeta?.fans)}\n\nTOP 5:\n${top5.map((v,i)=>`${i+1}. "${v.desc?.slice(0,80)}" — ${fmt(v.playCount)} views, ${fmt(v.diggCount)} likes, ${v.video?.duration}s`).join("\n")}\n\nBOTTOM 5:\n${bottom5.map((v,i)=>`${i+1}. "${v.desc?.slice(0,80)}" — ${fmt(v.playCount)} views`).join("\n")}`
    );
    setProfileResult({...(parseJSON(raw)||{raw}),stats:{totalViews,totalLikes,totalComments,totalShares,avgViews,avgEngagement,followers:videos[0]?.authorMeta?.fans},top5,bottom5,videoCount:videos.length});
  });

  const runPredict=async()=>{
    setError("");setLoading(true);
    try{
      if(!geminiSaved)throw new Error("Connect Gemini key first.");
      if(!predictFile)throw new Error("Upload a video first.");
      setLoadMsg("Reading your video...");
      const reader=new FileReader();
      const base64=await new Promise((res,rej)=>{reader.onload=e=>res(e.target.result.split(",")[1]);reader.onerror=rej;reader.readAsDataURL(predictFile);});
      setLoadMsg("Gemini is watching your video...");
      const geminiBody={
        contents:[{parts:[
          {text:"You are a TikTok viral prediction expert. Watch this video and predict viral potential BEFORE posting. Creator: @aldavincii approaching 1M followers, mother-son content, travel, comedy, brand deals Netflix/Amazon/Paramount. Analyze hook first 3 seconds, pacing, energy, audio, emotional pull, structure. Return ONLY JSON in ```json blocks: {\"hookScore\":7,\"retentionScore\":7,\"shareabilityScore\":7,\"emotionScore\":7,\"overallViralScore\":7,\"predictedViews\":\"50K-200K\",\"confidence\":\"Medium\",\"verdict\":\"POST IT\",\"hookAnalysis\":\"2 sentences\",\"whyItWillWork\":[\"r1\",\"r2\",\"r3\"],\"whyItMightFlop\":[\"r1\",\"r2\"],\"fixBeforePosting\":[\"f1\",\"f2\",\"f3\"],\"bestTimeToPost\":\"day time\",\"captionSuggestion\":\"caption with hashtags\",\"viralTrigger\":\"the one thing\"}"},
          {inline_data:{mime_type:predictFile.type||"video/mp4",data:base64}}
        ]}],
        generationConfig:{temperature:0.4,maxOutputTokens:2048}
      };
      const res=await fetch("/api/gemini",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:geminiKey,body:geminiBody})});
      const d=await res.json();
      if(d.error)throw new Error("Gemini: "+(d.error.message||JSON.stringify(d.error)));
      const text=d.candidates?.[0]?.content?.parts?.[0]?.text||"";
      setPredictResult(parseJSON(text)||{raw:text});
    }catch(e){setError(e.message);}
    setLoading(false);setLoadMsg("");
  };

  const runCompetitor=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    if(!compUrl)throw new Error("Paste a TikTok video URL.");
    let engagementData=null,engBlock="Apify not connected.";
    if(apifySaved){
      setLoadMsg("Pulling live stats...");
      try{engagementData=await apifyTikTokVideo(apifyKey,compUrl);engBlock=`Views:${fmt(engagementData.playCount)},Likes:${fmt(engagementData.diggCount)},Comments:${fmt(engagementData.commentCount)},Shares:${fmt(engagementData.shareCount)},Followers:${fmt(engagementData.authorMeta?.fans)},Duration:${engagementData.video?.duration}s,Caption:${engagementData.desc}`;}
      catch(e){engBlock="Apify error: "+e.message;}
    }
    setLoadMsg("Analyzing with AI...");
    let videoAnalysis="";
    try{
      const geminiBody={contents:[{parts:[{text:`Watch this TikTok carefully. Analyze: exact opening hook first 3 seconds, beat-by-beat structure, pacing, editing, text overlays, emotional tone, sound usage, why viral or not. Be specific.`},{file_data:{mime_type:"video/mp4",file_uri:compUrl}}]}],generationConfig:{temperature:0.4,maxOutputTokens:2048}};
      const res=await fetch("/api/gemini",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:geminiKey,body:geminiBody})});
      const d=await res.json();
      if(d.error)throw new Error();
      videoAnalysis=d.candidates?.[0]?.content?.parts?.[0]?.text||"";
    }catch{
      videoAnalysis=await geminiText(geminiKey,`Analyze this TikTok URL for viral patterns: ${compUrl}. Describe hook structure, pacing, emotional driver, shareability.`);
    }
    const raw=await claude(
      `Viral strategist. Synthesize Gemini analysis + Apify data into formula. Return ONLY JSON in \`\`\`json blocks: {"title":"formula name","viralScore":1-10,"hookScore":1-10,"retentionScore":1-10,"shareabilityScore":1-10,"emotionScore":1-10,"performanceSummary":"1 sentence","hookBreakdown":"2 sentences","structure":["beat1","beat2","beat3","beat4","beat5"],"whyItWorks":"2-3 sentences","emotionalDriver":"emotion","formula":"one sentence","steal":["t1","t2","t3"],"avoid":["w1"],"tags":["tag1","tag2","tag3"]}`,
      `Gemini: ${videoAnalysis}\n\nStats: ${engBlock}\n\nURL: ${compUrl}`
    );
    setCompResult({...(parseJSON(raw)||{raw}),engagement:engagementData});
  });

  const runScript=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    if(!scriptTopic)throw new Error("Enter a video topic.");
    setLoadMsg("Writing your script...");
    const raw=await geminiText(geminiKey,
      `Viral TikTok scriptwriter for @aldavincii. Creator: ${CREATOR}. Write in Antonio's voice — confident, warm, culturally fluent. Topic: ${scriptTopic}. Angle: ${scriptAngle}.
Return ONLY JSON in \`\`\`json blocks: {"title":"concept","hook":"exact first line 0-2s","whyThisHook":"why stops scroll","script":[{"beat":"Hook","action":"what you do","dialogue":"what you say","duration":"0-3s"},{"beat":"Setup","action":"...","dialogue":"...","duration":"3-8s"},{"beat":"Turn","action":"...","dialogue":"...","duration":"8-20s"},{"beat":"Payoff","action":"...","dialogue":"...","duration":"20-35s"},{"beat":"CTA","action":"...","dialogue":"...","duration":"35-45s"}],"visualDirection":"camera cuts overlays","soundStrategy":"music rec","caption":"full caption hashtags","viralPotential":1-10,"whyItWillWork":"2 sentences"}`
    );
    setScriptResult(parseJSON(raw)||{raw});
  });

  const runAnalyzeMe=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    let myEngagement=null,engBlock="No stats.";
    if(apifySaved&&myMode==="url"&&myUrl){
      setLoadMsg("Pulling your stats...");
      try{myEngagement=await apifyTikTokVideo(apifyKey,myUrl);engBlock=`Views:${fmt(myEngagement.playCount)},Likes:${fmt(myEngagement.diggCount)},Comments:${fmt(myEngagement.commentCount)},Shares:${fmt(myEngagement.shareCount)}`;}
      catch(e){engBlock="Apify error: "+e.message;}
    }
    let videoAnalysis=myMode==="url"?"":myText;
    if(myMode==="url"&&myUrl){
      setLoadMsg("Gemini watching your video...");
      try{
        const geminiBody={contents:[{parts:[{text:"Watch this @aldavincii TikTok. Analyze: hook, structure, pacing, editing, emotional tone, what works, what's missing. Be direct and honest."},{file_data:{mime_type:"video/mp4",file_uri:myUrl}}]}],generationConfig:{temperature:0.4,maxOutputTokens:2048}};
        const res=await fetch("/api/gemini",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:geminiKey,body:geminiBody})});
        const d=await res.json();
        if(!d.error)videoAnalysis=d.candidates?.[0]?.content?.parts?.[0]?.text||"";
        else throw new Error();
      }catch{videoAnalysis=await geminiText(geminiKey,`Analyze @aldavincii TikTok: ${myUrl}. Hook strength, structure, what worked, what missed.`);}
    }
    setLoadMsg("Building your breakdown...");
    const raw=await claude(
      `Senior creator strategist. Creator: ${CREATOR}. Be brutally honest. Return ONLY JSON in \`\`\`json blocks: {"overallScore":1-10,"hookScore":1-10,"retentionScore":1-10,"brandScore":1-10,"growthScore":1-10,"numbersRead":"1 sentence","whatWorked":["w1","w2","w3"],"whatMissed":["m1","m2"],"hookAnalysis":"2 sentences","brandAnalysis":"brand fit","ceiling":"what limits this","breakthroughMove":"ONE change for 2x","patternInsight":"content pattern","nextVideo":"exactly what to film next","directNote":"direct message to Antonio about 2M+"}`,
      `Analysis: ${videoAnalysis}\n\nStats: ${engBlock}`
    );
    setMyResult({...(parseJSON(raw)||{raw}),engagement:myEngagement});
  });

  const runStrategy=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    setLoadMsg("Building your strategy...");
    const raw=await geminiText(geminiKey,
      `Top creator growth strategist. Build personalized strategy for @aldavincii. Creator: ${CREATOR}
Return ONLY JSON in \`\`\`json blocks: {"coreIdentity":"1 sentence","biggestAsset":"most powerful underutilized asset","niches":[{"name":"niche","why":"fits Antonio","potential":"growth potential","competitors":"who owns it","howToWin":"Antonio's angle","urgency":"why now","difficulty":"Easy/Medium/Hard"},{"name":"...","why":"...","potential":"...","competitors":"...","howToWin":"...","urgency":"...","difficulty":"..."},{"name":"...","why":"...","potential":"...","competitors":"...","howToWin":"...","urgency":"...","difficulty":"..."},{"name":"...","why":"...","potential":"...","competitors":"...","howToWin":"...","urgency":"...","difficulty":"..."}],"topNiche":"pursue first and why","brandGaps":["g1","g2","g3"],"revenueAngles":["a1","a2","a3"],"milestoneRoadmap":["to 1M","to 2M","to 5M"],"hardTruth":"what's holding Antonio back"}`
    );
    setStrategyResult(parseJSON(raw)||{raw});
  });

  const runBrand=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    setLoadMsg("Defining your brand...");
    const raw=await geminiText(geminiKey,
      `Brand strategist for creators. Define @aldavincii's brand. Creator: ${CREATOR}
Return ONLY JSON in \`\`\`json blocks: {"brandStatement":"one powerful sentence","tagline":"5 words or less","coreValues":["v1","v2","v3"],"audience":{"primary":"core now","aspirational":"speak to next","psychographic":"what they believe"},"contentPillars":[{"pillar":"name","description":"in practice","percentage":"%"},{"pillar":"...","description":"...","percentage":"..."},{"pillar":"...","description":"...","percentage":"..."},{"pillar":"...","description":"...","percentage":"..."}],"toneOfVoice":["t1","t2","t3"],"whatMakesHimDifferent":"unmissable combination","whatToStop":"dilutes the brand","brandComps":["c1","c2","c3"],"northStar":"at 5M — what does that look like"}`
    );
    setBrandResult(parseJSON(raw)||{raw});
  });

  const runCalendar=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    setLoadMsg("Building your calendar...");
    const raw=await geminiText(geminiKey,
      `Content strategist for @aldavincii. 7-day TikTok calendar. Creator: ${CREATOR}. Focus: ${calFocus}.
Return ONLY JSON in \`\`\`json blocks: {"weekTheme":"theme","days":[{"day":"Monday","concept":"...","hook":"...","angle":"...","effort":"Low/Medium/High","viralPotential":8,"notes":"..."},{"day":"Tuesday","concept":"...","hook":"...","angle":"...","effort":"Low","viralPotential":7,"notes":"..."},{"day":"Wednesday","concept":"...","hook":"...","angle":"...","effort":"Medium","viralPotential":9,"notes":"..."},{"day":"Thursday","concept":"...","hook":"...","angle":"...","effort":"Low","viralPotential":7,"notes":"..."},{"day":"Friday","concept":"...","hook":"...","angle":"...","effort":"High","viralPotential":9,"notes":"..."},{"day":"Saturday","concept":"...","hook":"...","angle":"...","effort":"Medium","viralPotential":8,"notes":"..."},{"day":"Sunday","concept":"...","hook":"...","angle":"...","effort":"Low","viralPotential":6,"notes":"..."}],"heroVideo":"highest potential day and why","repurposeTip":"one video into 3 pieces"}`
    );
    setCalResult(parseJSON(raw)||{raw});
  });

  const runUnblock=()=>run(async()=>{
    if(!geminiSaved)throw new Error("Connect Gemini key first.");
    setLoadMsg("Breaking through your block...");
    const raw=await geminiText(geminiKey,
      `Creative director for @aldavincii experiencing creative block. Creator: ${CREATOR}. Feeling: ${blockFeeling||"general creative block and uncertainty"}.
Be warm, direct, specific. Return ONLY JSON in \`\`\`json blocks: {"reframe":"what the block is telling him","rootCause":"likely real reason","immediateAction":"do TODAY","ideas":[{"title":"idea","hook":"hook","angle":"angle","viralPotential":8,"whyNow":"why now","effort":"Low"},{"title":"...","hook":"...","angle":"...","viralPotential":7,"whyNow":"...","effort":"Medium"},{"title":"...","hook":"...","angle":"...","viralPotential":9,"whyNow":"...","effort":"Low"},{"title":"...","hook":"...","angle":"...","viralPotential":8,"whyNow":"...","effort":"High"},{"title":"...","hook":"...","angle":"...","viralPotential":7,"whyNow":"...","effort":"Low"},{"title":"...","hook":"...","angle":"...","viralPotential":8,"whyNow":"...","effort":"Medium"}],"mindsetShift":"direct shift needed","reminder":"Antonio's journey reminder","nextStep":"practical next step"}`
    );
    setUnblockResult(parseJSON(raw)||{raw});
  });

  if(!unlocked){
    return(
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Inter',-apple-system,sans-serif"}}>
        <style>{`*{box-sizing:border-box;} input{color-scheme:dark;}`}</style>
        <div style={{width:"100%",maxWidth:380}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{width:56,height:56,borderRadius:16,background:`linear-gradient(135deg,${C.accent},#B06FFF)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>⚡</div>
            <div style={{fontSize:22,fontWeight:900,letterSpacing:"-0.025em",color:C.text,marginBottom:6}}>Viral Research Machine</div>
            <div style={{fontSize:12,color:C.muted}}>@ALDAVINCII · PRIVATE ACCESS ONLY</div>
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

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:80}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box;} textarea,input{color-scheme:dark;}`}</style>

      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"20px 18px 0"}}>
        <div style={{maxWidth:680,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:18}}>
            <div style={{width:38,height:38,borderRadius:11,background:`linear-gradient(135deg,${C.accent},#B06FFF)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>⚡</div>
            <div>
              <div style={{fontSize:17,fontWeight:900,letterSpacing:"-0.025em"}}>Viral Research Machine</div>
              <div style={{fontSize:10,color:C.muted,letterSpacing:"0.12em",marginTop:1}}>@ALDAVINCII · GEMINI + APIFY + CLAUDE</div>
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
          <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>Gemini watches videos · Apify pulls live data · Claude builds strategy · <span style={{color:C.dim}}>Keys stay in your browser only.</span></div>
        </Card>

        {error&&<div style={{background:"#1A0808",border:`1px solid ${C.red}40`,borderRadius:10,padding:"11px 14px",marginBottom:14,fontSize:13,color:C.red}}>⚠ {error}</div>}
        {loading&&(
          <div style={{background:C.card,border:`1px solid ${C.accent}30`,borderRadius:10,padding:"13px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:15,height:15,border:`2px solid ${C.accent}`,borderTop:"2px solid transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/>
            <span style={{fontSize:13,color:C.muted}}>{loadMsg||"Working..."}</span>
          </div>
        )}

        {tab==="profile"&&(
          <div>
            <Card glow>
              <Label color={C.accent}>Profile Deep Dive</Label>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:14}}>Paste any TikTok profile URL — yours or a competitor's. Apify pulls all videos automatically, then AI finds every pattern, strength, and blind spot.</div>
              <div style={{marginBottom:10}}><TextInput placeholder="https://www.tiktok.com/@aldavincii" value={profileHandle} onChange={e=>setProfileHandle(e.target.value)}/></div>
              <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Videos to Analyze</div>
              <div style={{display:"flex",gap:7,marginBottom:14}}>
                {[10,20,30].map(n=><button key={n} onClick={()=>setProfileCount(n)} style={{padding:"6px 16px",borderRadius:8,border:`1px solid ${profileCount===n?C.accent:C.border}`,background:profileCount===n?C.accent+"18":"transparent",color:profileCount===n?C.accent:C.muted,fontSize:12,cursor:"pointer",fontWeight:profileCount===n?700:400}}>Last {n}</button>)}
              </div>
              <div style={{fontSize:11,color:C.muted,marginBottom:12}}>{apifySaved?"✓ Apify connected — will pull videos automatically":"⚠ Apify token required"}</div>
              <Btn onClick={runProfile} disabled={loading||!apifySaved||!geminiSaved} full>Analyze This Profile 👤</Btn>
            </Card>
            {profileResult&&!profileResult.raw&&(()=>{const r=profileResult;const s=r.stats;return<>
              <Card><Label color={C.amber}>Channel Stats — Last {r.videoCount} Videos</Label>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
                  <StatPill label="Total Views" value={fmt(s.totalViews)} color={C.accent}/>
                  <StatPill label="Avg Views" value={fmt(s.avgViews)} color={C.blue}/>
                  <StatPill label="Total Likes" value={fmt(s.totalLikes)} color={C.pink}/>
                  <StatPill label="Eng Rate" value={s.avgEngagement?s.avgEngagement+"%":"—"} color={C.green}/>
                </div>
              </Card>
              <Card glow>
                <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:14}}>
                  <div style={{width:56,height:56,borderRadius:14,background:`linear-gradient(135deg,${C.accent},#B06FFF)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:900,flexShrink:0}}>{r.overallGrade}</div>
                  <div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.executiveSummary}</div>
                </div>
                <Bar label="Channel Health" score={r.channelHealth} color={C.accent}/>
                <Bar label="Consistency" score={r.consistencyScore} color={C.green}/>
                <Bar label="Hook Strength" score={r.hookStrengthAvg} color={C.amber}/>
                <Bar label="Engagement" score={r.engagementScore} color={C.pink}/>
                <Bar label="Growth Momentum" score={r.growthMomentum} color="#FF9F47"/>
              </Card>
              <Card><Label color={C.green}>Top 5 Performing Videos</Label>
                {r.top5.map((v,i)=><div key={i} style={{background:C.surface,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{minWidth:22,height:22,borderRadius:6,background:C.green+"25",color:C.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>#{i+1}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:"#C8CAE0",marginBottom:5,lineHeight:1.5}}>{v.desc?.slice(0,80)||"No caption"}</div>
                    <div style={{display:"flex",gap:12}}><span style={{fontSize:11,color:C.accent}}>👁 {fmt(v.playCount)}</span><span style={{fontSize:11,color:C.pink}}>❤️ {fmt(v.diggCount)}</span><span style={{fontSize:11,color:C.amber}}>↗️ {fmt(v.shareCount)}</span><span style={{fontSize:11,color:C.muted}}>{v.video?.duration}s</span></div>
                  </div>
                </div>)}
              </Card>
              <Card><Label color={C.red}>Bottom 5 — Learn From These</Label>
                {r.bottom5.map((v,i)=><div key={i} style={{background:C.surface,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{minWidth:22,height:22,borderRadius:6,background:C.red+"25",color:C.red,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>↓</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:"#C8CAE0",marginBottom:5}}>{v.desc?.slice(0,80)||"No caption"}</div>
                    <div style={{display:"flex",gap:12}}><span style={{fontSize:11,color:C.accent}}>👁 {fmt(v.playCount)}</span><span style={{fontSize:11,color:C.pink}}>❤️ {fmt(v.diggCount)}</span></div>
                  </div>
                </div>)}
              </Card>
              <Card><Label color={C.green}>What's Working</Label>{(r.topPatterns||[]).map((p,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.green}}>✓</span><span style={{fontSize:13,color:"#C8CAE0"}}>{p}</span></div>)}<div style={{height:1,background:C.border,margin:"12px 0"}}/><Label color={C.red}>What's Flopping</Label>{(r.floppingPatterns||[]).map((p,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.red}}>✕</span><span style={{fontSize:13,color:"#C8CAE0"}}>{p}</span></div>)}</Card>
              <Card><Label color={C.amber}>Hidden Strength</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:14}}>{r.hiddenStrength}</div><Label color={C.red}>Biggest Leak</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.biggestLeak}</div></Card>
              <Card><Label color={C.accent}>Content Gaps</Label>{(r.contentGaps||[]).map((g,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.accent}}>◆</span><span style={{fontSize:13,color:"#C8CAE0"}}>{g}</span></div>)}</Card>
              <Card glow><Label color={C.green}>Double Down On This</Label><div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:14,lineHeight:1.6}}>{r.doubleDown}</div><Label color={C.red}>Drop This Immediately</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.dropImmediately}</div></Card>
              <Card><Label color={C.amber}>Your Next 30 Days</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8}}>{r.next30Days}</div></Card>
              <Card glow><Label color={C.accent}>Path to 2M</Label><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.7,fontStyle:"italic"}}>"{r.pathTo2M}"</div></Card>
            </>; })()}
            {profileResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{profileResult.raw}</div></Card>}
          </div>
        )}

        {tab==="predict"&&(
          <div>
            <Card glow>
              <Label color={C.accent}>🎯 Pre-Post Viral Prediction</Label>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:14}}>Upload a video before you post it. Gemini watches it and gives you a go/no-go verdict with a predicted view range and specific fixes.</div>
            </Card>
            <Card>
              <Label>Upload Your Video</Label>
              <input ref={predictRef} type="file" accept="video/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f){setPredictFile(f);setPredictPreview(URL.createObjectURL(f));setPredictResult(null);}}}/>
              {!predictPreview?(
                <div onClick={()=>predictRef.current?.click()} style={{border:`2px dashed ${C.border}`,borderRadius:12,padding:"32px 20px",textAlign:"center",cursor:"pointer"}}>
                  <div style={{fontSize:32,marginBottom:8}}>📱</div>
                  <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>Tap to upload your video</div>
                  <div style={{fontSize:12,color:C.muted}}>MP4, MOV — the video you're about to post</div>
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
            {predictPreview&&<div style={{marginBottom:14}}><Btn onClick={runPredict} disabled={loading||!geminiSaved||!predictFile} full color={C.accent}>{loading?loadMsg||"Analyzing...":"Predict Viral Potential 🎯"}</Btn></div>}
            {predictResult&&!predictResult.raw&&(()=>{const r=predictResult;const vc=r.verdict&&r.verdict.includes("POST IT")?C.green:r.verdict&&r.verdict.includes("NEEDS")?C.amber:C.red;return<>
              <Card glow style={{borderColor:vc+"60"}}>
                <div style={{textAlign:"center",marginBottom:16}}>
                  <div style={{fontSize:26,fontWeight:900,color:vc,marginBottom:4}}>{r.verdict}</div>
                  <div style={{fontSize:13,color:C.muted}}>Confidence: <span style={{color:vc,fontWeight:700}}>{r.confidence}</span> · Predicted: <span style={{color:C.text,fontWeight:700}}>{r.predictedViews} views</span></div>
                </div>
                <Bar label="Overall Viral Score" score={r.overallViralScore} color={vc}/>
                <Bar label="Hook" score={r.hookScore} color={C.green}/>
                <Bar label="Retention" score={r.retentionScore} color={C.amber}/>
                <Bar label="Shareability" score={r.shareabilityScore} color={C.pink}/>
                <Bar label="Emotional Pull" score={r.emotionScore} color="#FF9F47"/>
              </Card>
              <Card><Label color={C.green}>Hook Analysis</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:14}}>{r.hookAnalysis}</div><Label color={C.accent}>Viral Trigger</Label><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.6}}>{r.viralTrigger}</div></Card>
              <Card><Label color={C.green}>Why It Will Work</Label>{(r.whyItWillWork||[]).map((w,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.green}}>✓</span><span style={{fontSize:13,color:"#C8CAE0"}}>{w}</span></div>)}<div style={{height:1,background:C.border,margin:"12px 0"}}/><Label color={C.red}>Why It Might Flop</Label>{(r.whyItMightFlop||[]).map((w,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.red}}>✕</span><span style={{fontSize:13,color:"#C8CAE0"}}>{w}</span></div>)}</Card>
              {(r.fixBeforePosting||[]).length>0&&<Card style={{borderColor:C.amber+"50"}}><Label color={C.amber}>Fix Before Posting</Label>{r.fixBeforePosting.map((f,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.amber}}>⚡</span><span style={{fontSize:13,color:"#C8CAE0"}}>{f}</span></div>)}</Card>}
              <Card><Label color={C.blue}>Best Time to Post</Label><div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:14}}>{r.bestTimeToPost}</div><Label color={C.pink}>Ready-to-Post Caption</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8,background:C.surface,borderRadius:8,padding:"12px 14px"}}>{r.captionSuggestion}</div></Card>
            </>;})()} 
            {predictResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{predictResult.raw}</div></Card>}
          </div>
        )}

        {tab==="competitor"&&(
          <div>
            <Card>
              <Label>Drop a Specific TikTok Video URL</Label>
              <div style={{marginBottom:8}}><TextInput placeholder="https://www.tiktok.com/@username/video/1234567890..." value={compUrl} onChange={e=>setCompUrl(e.target.value)}/></div>
              <div style={{fontSize:11,color:C.muted,marginBottom:10}}>Must be a specific video URL, not a profile. {apifySaved?"✓ Live stats enabled":"⚠ Add Apify for live stats"}</div>
              <Btn onClick={runCompetitor} disabled={loading||!compUrl||!geminiSaved} full>Reverse Engineer This Video ⚡</Btn>
            </Card>
            {compResult&&!compResult.raw&&(()=>{const r=compResult;return<>
              {r.engagement&&<Card><Label color={C.amber}>Live Engagement Data</Label>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
                  <StatPill label="Views" value={fmt(r.engagement.playCount)} color={C.accent}/>
                  <StatPill label="Likes" value={fmt(r.engagement.diggCount)} color={C.pink}/>
                  <StatPill label="Comments" value={fmt(r.engagement.commentCount)} color={C.green}/>
                  <StatPill label="Shares" value={fmt(r.engagement.shareCount)} color={C.amber}/>
                </div>
                {r.performanceSummary&&<div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>{r.performanceSummary}</div>}
              </Card>}
              <Card glow><div style={{fontSize:16,fontWeight:900,marginBottom:8}}>{r.title}</div><div style={{marginBottom:14}}>{(r.tags||[]).map(t=><Chip key={t}>{t}</Chip>)}</div><Bar label="Viral Score" score={r.viralScore} color={C.accent}/><Bar label="Hook" score={r.hookScore} color={C.green}/><Bar label="Retention" score={r.retentionScore} color={C.amber}/><Bar label="Shareability" score={r.shareabilityScore} color={C.pink}/><Bar label="Emotional Pull" score={r.emotionScore} color="#FF9F47"/></Card>
              <Card><Label color={C.green}>Hook Breakdown</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.hookBreakdown}</div></Card>
              <Card><Label>Video Structure</Label>{(r.structure||[]).map((b,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}><div style={{minWidth:22,height:22,borderRadius:6,background:C.accent+"25",color:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0,marginTop:1}}>{i+1}</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{b}</div></div>)}</Card>
              <Card><Label color={C.green}>Why It Works</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:10}}>{r.whyItWorks}</div><Chip color={C.green}>{r.emotionalDriver}</Chip></Card>
              <Card><Label color={C.amber}>Steal These</Label>{(r.steal||[]).map((s,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.green}}>→</span><span style={{fontSize:13,color:"#C8CAE0"}}>{s}</span></div>)}{(r.avoid||[]).length>0&&<><div style={{height:1,background:C.border,margin:"12px 0"}}/><Label color={C.red}>Skip These</Label>{r.avoid.map((s,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.red}}>✕</span><span style={{fontSize:13,color:"#C8CAE0"}}>{s}</span></div>)}</>}</Card>
              <Card glow><Label>The Formula</Label><div style={{fontSize:14,color:C.text,fontWeight:700,fontStyle:"italic",lineHeight:1.6}}>"{r.formula}"</div></Card>
            </>;})()} 
            {compResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{compResult.raw}</div></Card>}
          </div>
        )}

        {tab==="script"&&(
          <div>
            <Card>
              <Label>What's the video about?</Label>
              <div style={{marginBottom:12}}><TextInput placeholder="e.g. Surprising my mom with a first-class flight to Paris..." value={scriptTopic} onChange={e=>setScriptTopic(e.target.value)}/></div>
              <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Content Angle</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
                {ANGLES.map(a=><button key={a.id} onClick={()=>setScriptAngle(a.id)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${scriptAngle===a.id?C.accent:C.border}`,background:scriptAngle===a.id?C.accent+"18":"transparent",color:scriptAngle===a.id?C.accent:C.muted,fontSize:12,cursor:"pointer",fontWeight:scriptAngle===a.id?700:400}}>{a.label}</button>)}
              </div>
              <Btn onClick={runScript} disabled={loading||!scriptTopic||!geminiSaved} full>Generate Script ✍️</Btn>
            </Card>
            {scriptResult&&!scriptResult.raw&&(()=>{const r=scriptResult;return<>
              <Card glow><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{fontSize:16,fontWeight:900,flex:1,marginRight:12}}>{r.title}</div><div style={{fontSize:26,fontWeight:900,color:C.accent,lineHeight:1}}>{r.viralPotential}<span style={{fontSize:12,color:C.muted,fontWeight:400}}>/10</span></div></div><div style={{fontSize:12,color:C.muted,marginTop:8,lineHeight:1.6}}>{r.whyItWillWork}</div></Card>
              <Card><Label color={C.green}>Opening Hook</Label><div style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:6}}>"{r.hook}"</div><div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>{r.whyThisHook}</div></Card>
              <Card><Label>Shot-by-Shot Script</Label>{(r.script||[]).map((beat,i)=>{const bc=[C.green,C.accent,C.amber,C.pink,C.accent][i%5];return(<div key={i} style={{background:C.surface,borderRadius:10,padding:"12px 14px",marginBottom:10,borderLeft:`3px solid ${i===0?C.green:i===r.script.length-1?C.accent:C.border}`}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><Chip color={bc}>{beat.beat}</Chip><span style={{fontSize:10,color:C.muted}}>{beat.duration}</span></div>{beat.action&&<div style={{fontSize:11,color:C.muted,marginBottom:5}}>📹 {beat.action}</div>}{beat.dialogue&&<div style={{fontSize:13,color:C.text,fontStyle:"italic"}}>"{beat.dialogue}"</div>}</div>);})}</Card>
              <Card><Label color={C.amber}>Visual Direction</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:14}}>{r.visualDirection}</div><Label color={C.amber}>Sound Strategy</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.soundStrategy}</div></Card>
              <Card><Label color={C.pink}>Ready-to-Post Caption</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.8,background:C.surface,borderRadius:8,padding:"12px 14px"}}>{r.caption}</div></Card>
            </>;})()} 
            {scriptResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{scriptResult.raw}</div></Card>}
          </div>
        )}

        {tab==="analyze"&&(
          <div>
            <Card glow><Label color={C.accent}>Your Creator DNA</Label><div style={{fontSize:12,color:C.muted,lineHeight:1.7}}>@aldavincii · ~1M followers · Mother-son franchise · Travel series<br/>Amazon · Netflix · Paramount · Lionsgate · Universal</div></Card>
            <Card>
              <Label>Analyze a specific video</Label>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                {[{id:"url",label:"TikTok URL"},{id:"manual",label:"Describe It"}].map(m=><button key={m.id} onClick={()=>setMyMode(m.id)} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${myMode===m.id?C.accent:C.border}`,background:myMode===m.id?C.accent+"18":"transparent",color:myMode===m.id?C.accent:C.muted,fontSize:12,cursor:"pointer",fontWeight:myMode===m.id?700:400}}>{m.label}</button>)}
              </div>
              {myMode==="url"?<div style={{marginBottom:12}}><TextInput placeholder="https://www.tiktok.com/@aldavincii/video/..." value={myUrl} onChange={e=>setMyUrl(e.target.value)}/></div>:<div style={{marginBottom:12}}><TextInput placeholder="Describe your video — hook, what happened, performance, what felt off..." value={myText} onChange={e=>setMyText(e.target.value)} rows={4}/></div>}
              <Btn onClick={runAnalyzeMe} disabled={loading||!geminiSaved||(myMode==="url"?!myUrl:!myText)} full>Analyze My Video 🔬</Btn>
            </Card>
            {myResult&&!myResult.raw&&(()=>{const r=myResult;return<>
              {r.engagement&&<Card><Label color={C.amber}>Your Video Stats</Label><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:r.numbersRead?12:0}}><StatPill label="Views" value={fmt(r.engagement.playCount)} color={C.accent}/><StatPill label="Likes" value={fmt(r.engagement.diggCount)} color={C.pink}/><StatPill label="Comments" value={fmt(r.engagement.commentCount)} color={C.green}/><StatPill label="Shares" value={fmt(r.engagement.shareCount)} color={C.amber}/></div>{r.numbersRead&&<div style={{fontSize:12,color:C.muted,marginTop:10,lineHeight:1.6}}>{r.numbersRead}</div>}</Card>}
              <Card glow><Label>Performance Breakdown</Label><Bar label="Overall" score={r.overallScore} color={C.accent}/><Bar label="Hook" score={r.hookScore} color={C.green}/><Bar label="Retention" score={r.retentionScore} color={C.amber}/><Bar label="Brand Alignment" score={r.brandScore} color={C.pink}/><Bar label="Growth Potential" score={r.growthScore} color="#FF9F47"/></Card>
              <Card><Label color={C.green}>What Worked</Label>{(r.whatWorked||[]).map((w,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.green}}>✓</span><span style={{fontSize:13,color:"#C8CAE0"}}>{w}</span></div>)}</Card>
              <Card><Label color={C.red}>What Missed</Label>{(r.whatMissed||[]).map((w,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.red}}>✕</span><span style={{fontSize:13,color:"#C8CAE0"}}>{w}</span></div>)}</Card>
              <Card><Label color={C.amber}>The Breakthrough Move</Label><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.6}}>{r.breakthroughMove}</div></Card>
              <Card><Label>Pattern Insight</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,marginBottom:14}}>{r.patternInsight}</div><Label color={C.green}>Make This Next</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.nextVideo}</div></Card>
              <Card glow><Label color={C.accent}>Direct Note to Antonio</Label><div style={{fontSize:14,color:C.text,lineHeight:1.8,fontStyle:"italic"}}>"{r.directNote}"</div></Card>
            </>;})()} 
            {myResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{myResult.raw}</div></Card>}
          </div>
        )}

        {tab==="strategy"&&(
          <div>
            <Card glow><Label color={C.accent}>Personalized Growth Strategy</Label><div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:14}}>Deep analysis of your brand position, niches you should own, and roadmap to 2M+.</div><Btn onClick={runStrategy} disabled={loading||!geminiSaved} full>Build My Strategy 🧭</Btn></Card>
            {strategyResult&&!strategyResult.raw&&(()=>{const r=strategyResult;return<>
              <Card glow><Label color={C.accent}>Core Identity</Label><div style={{fontSize:15,fontWeight:700,color:C.text,lineHeight:1.6,marginBottom:14}}>{r.coreIdentity}</div><Label color={C.green}>Biggest Untapped Asset</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.biggestAsset}</div></Card>
              <Card><Label>Niche Opportunities</Label>{(r.niches||[]).map((n,i)=>(<div key={i} style={{background:C.surface,borderRadius:12,padding:"14px 16px",marginBottom:12,borderLeft:`3px solid ${[C.accent,C.green,C.amber,C.pink][i%4]}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}><div style={{fontSize:14,fontWeight:800,color:C.text}}>{n.name}</div><Chip color={n.difficulty==="Easy"?C.green:n.difficulty==="Medium"?C.amber:C.red}>{n.difficulty}</Chip></div><div style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:4}}><span style={{color:C.accent}}>Why you: </span>{n.why}</div><div style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:4}}><span style={{color:C.green}}>Your angle: </span>{n.howToWin}</div><div style={{fontSize:12,color:C.muted,lineHeight:1.6}}><span style={{color:C.amber}}>Why now: </span>{n.urgency}</div></div>))}</Card>
              <Card glow><Label color={C.green}>Top Recommendation</Label><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.6}}>{r.topNiche}</div></Card>
              <Card><Label color={C.amber}>Revenue Angles</Label>{(r.revenueAngles||[]).map((a,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:9}}><span style={{color:C.pink}}>💰</span><span style={{fontSize:13,color:"#C8CAE0"}}>{a}</span></div>)}</Card>
              <Card><Label>Milestone Roadmap</Label>{(r.milestoneRoadmap||[]).map((m,i)=>(<div key={i} style={{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}}><div style={{minWidth:60,padding:"3px 8px",borderRadius:6,background:[C.accent,C.green,C.amber][i]+"25",color:[C.accent,C.green,C.amber][i],fontSize:10,fontWeight:800,textAlign:"center",flexShrink:0}}>{["1M","2M","5M"][i]}</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6,paddingTop:2}}>{m}</div></div>))}</Card>
              <Card style={{borderColor:C.red+"50"}}><Label color={C.red}>Hard Truth</Label><div style={{fontSize:14,color:C.text,fontWeight:600,lineHeight:1.7,fontStyle:"italic"}}>"{r.hardTruth}"</div></Card>
            </>;})()} 
            {strategyResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{strategyResult.raw}</div></Card>}
          </div>
        )}

        {tab==="brand"&&(
          <div>
            <Card glow><Label color={C.accent}>Brand Identity Engine</Label><div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:14}}>Defines exactly who @aldavincii is, your content pillars, tone of voice, and the version of you at 5M.</div><Btn onClick={runBrand} disabled={loading||!geminiSaved} full>Define My Brand ⭐</Btn></Card>
            {brandResult&&!brandResult.raw&&(()=>{const r=brandResult;return<>
              <Card glow><Label color={C.accent}>Brand Statement</Label><div style={{fontSize:16,fontWeight:800,color:C.text,lineHeight:1.5,marginBottom:14}}>{r.brandStatement}</div><Label color={C.green}>Tagline</Label><div style={{fontSize:22,fontWeight:900,color:C.green,letterSpacing:"-0.02em"}}>{r.tagline}</div></Card>
              <Card><Label>Core Values</Label>{(r.coreValues||[]).map((v,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:10}}><span style={{color:C.accent,flexShrink:0}}>◆</span><span style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{v}</span></div>)}</Card>
              <Card><Label color={C.blue}>Your Audience</Label><div style={{marginBottom:10}}><div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Right Now</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.audience?.primary}</div></div><div style={{marginBottom:10}}><div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Speak to Next</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.audience?.aspirational}</div></div><div><div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Their Mindset</div><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.audience?.psychographic}</div></div></Card>
              <Card><Label>Content Pillars</Label>{(r.contentPillars||[]).map((p,i)=>{const c=[C.accent,C.green,C.amber,C.pink][i%4];return(<div key={i} style={{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}}><div style={{minWidth:44,padding:"3px 6px",borderRadius:6,background:c+"25",color:c,fontSize:10,fontWeight:800,textAlign:"center",flexShrink:0}}>{p.percentage}</div><div><div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:3}}>{p.pillar}</div><div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>{p.description}</div></div></div>);})}</Card>
              <Card glow><Label color={C.green}>What Makes You Unmissable</Label><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.6,marginBottom:14}}>{r.whatMakesHimDifferent}</div><Label color={C.red}>Stop Doing This</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.whatToStop}</div></Card>
              <Card glow><Label color={C.accent}>@aldavincii at 5M</Label><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.7,fontStyle:"italic"}}>"{r.northStar}"</div></Card>
            </>;})()} 
            {brandResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{brandResult.raw}</div></Card>}
          </div>
        )}

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
            {calResult&&!calResult.raw&&(()=>{const r=calResult;return<>
              <Card glow><Label color={C.accent}>This Week's Theme</Label><div style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:10}}>{r.weekTheme}</div><Label color={C.green}>Hero Video</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.heroVideo}</div></Card>
              {(r.days||[]).map((d,i)=>{const c=[C.accent,C.green,C.amber,C.pink,C.blue,C.accent,C.green][i];return(<div key={i} style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,padding:"16px",marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:13,fontWeight:800,color:c}}>{d.day}</div><div style={{display:"flex",gap:6}}><Chip color={effortColor(d.effort)}>{d.effort}</Chip><span style={{fontSize:11,color:C.muted}}>{d.viralPotential}/10 🔥</span></div></div><div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>{d.concept}</div><div style={{fontSize:12,color:C.muted,marginBottom:6,fontStyle:"italic"}}>Hook: "{d.hook}"</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><Chip color={c}>{d.angle}</Chip><span style={{fontSize:11,color:C.dim}}>{d.notes}</span></div></div>);})}
              <Card><Label color={C.amber}>Repurpose Tip</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.repurposeTip}</div></Card>
            </>;})()} 
            {calResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{calResult.raw}</div></Card>}
          </div>
        )}

        {tab==="unblock"&&(
          <div>
            <Card glow>
              <Label color={C.accent}>Creative Unblock</Label>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:14}}>Tell me what you're feeling — or leave it blank. No judgment. Just clarity.</div>
              <div style={{marginBottom:12}}><TextInput placeholder="e.g. I don't know what direction to go, nothing feels good enough..." value={blockFeeling} onChange={e=>setBlockFeeling(e.target.value)} rows={3}/></div>
              <Btn onClick={runUnblock} disabled={loading||!geminiSaved} full color={C.pink}>Break Through My Block 💡</Btn>
            </Card>
            {unblockResult&&!unblockResult.raw&&(()=>{const r=unblockResult;return<>
              <Card glow style={{borderColor:C.pink+"50"}}><Label color={C.pink}>What Your Block Is Actually Telling You</Label><div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.7,marginBottom:14}}>{r.reframe}</div><Label color={C.muted}>Root Cause</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.6}}>{r.rootCause}</div></Card>
              <Card glow style={{borderColor:C.green+"50"}}><Label color={C.green}>Do This Today</Label><div style={{fontSize:15,fontWeight:700,color:C.text,lineHeight:1.6}}>{r.immediateAction}</div></Card>
              <Card><Label color={C.accent}>6 Ideas Ready to Film Right Now</Label>{(r.ideas||[]).map((idea,i)=>{const c=[C.accent,C.green,C.amber,C.pink,C.blue,C.accent][i];return(<div key={i} style={{background:C.surface,borderRadius:12,padding:"14px 16px",marginBottom:10,borderLeft:`3px solid ${c}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}><div style={{fontSize:14,fontWeight:700,color:C.text,flex:1,marginRight:10}}>{idea.title}</div><div style={{display:"flex",gap:5,flexShrink:0}}><Chip color={effortColor(idea.effort)}>{idea.effort}</Chip><span style={{fontSize:10,color:C.muted,paddingTop:3}}>{idea.viralPotential}/10</span></div></div><div style={{fontSize:12,color:C.muted,fontStyle:"italic",marginBottom:5}}>"{idea.hook}"</div><div style={{fontSize:11,color:c}}>{idea.whyNow}</div></div>);})}</Card>
              <Card><Label color={C.amber}>Mindset Shift</Label><div style={{fontSize:14,fontWeight:600,color:C.text,lineHeight:1.7,marginBottom:14}}>{r.mindsetShift}</div><Label color={C.green}>Remember This</Label><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7}}>{r.reminder}</div></Card>
              <Card glow><Label color={C.accent}>Your Next Step</Label><div style={{fontSize:15,fontWeight:700,color:C.text,lineHeight:1.6}}>{r.nextStep}</div></Card>
            </>;})()} 
            {unblockResult?.raw&&<Card><div style={{fontSize:13,color:"#C8CAE0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{unblockResult.raw}</div></Card>}
          </div>
        )}

      </div>
    </div>
  );
}
