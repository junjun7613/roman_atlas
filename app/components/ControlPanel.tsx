'use client'

export default function ControlPanel() {
  const toggleSection = (sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (section) {
      section.style.display = section.style.display === 'none' ? 'block' : 'none'
    }
  }

  const toggleAll = (sectionId: string, checked: boolean) => {
    const checkboxes = document.querySelectorAll(`#${sectionId} input[type=checkbox]`)
    checkboxes.forEach((cb: any) => {
      cb.checked = checked
      cb.dispatchEvent(new Event('change'))
    })
  }

  return (
    <div className="absolute top-[60px] right-2.5 bg-white/95 px-[18px] py-3 rounded-md shadow-[0_2px_20px_rgba(0,0,0,0.3)] font-sans z-[1000] max-w-[250px] max-h-[90vh] overflow-y-auto">
      <h4 className="m-0 mb-2.5 text-[#333] text-[15px] border-b-2 border-[#6688ff] pb-1.5">表示設定</h4>

      {/* 基本レイヤー */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <h5
            className="m-0 text-[#555] text-[13px] cursor-pointer"
            onClick={() => toggleSection('baseLayersContent')}
          >
            ▼ 基本レイヤー
          </h5>
          <div className="text-[10px]">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); toggleAll('baseLayersContent', true) }}
              className="text-[#6688ff] no-underline mr-1.5"
            >
              全選択
            </a>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); toggleAll('baseLayersContent', false) }}
              className="text-[#6688ff] no-underline"
            >
              全解除
            </a>
          </div>
        </div>

        <div id="baseLayersContent" className="pl-2.5">
          <label className="flex items-center cursor-pointer mb-1.5">
            <input type="checkbox" id="toggleProvinces" defaultChecked className="mr-2 cursor-pointer" />
            <span className="text-[12px] text-[#555]">Province</span>
          </label>

          {/* 道路・河川サブセクション */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-[3px]">
              <h6
                className="m-0 text-[#666] text-[12px] cursor-pointer"
                onClick={() => toggleSection('routesContent')}
              >
                ▼ 道路・河川
              </h6>
              <div className="text-[10px]">
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); toggleAll('routesContent', true) }}
                  className="text-[#6688ff] no-underline mr-1.5"
                >
                  全選択
                </a>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); toggleAll('routesContent', false) }}
                  className="text-[#6688ff] no-underline"
                >
                  全解除
                </a>
              </div>
            </div>

            <div id="routesContent" className="pl-[15px]">
              <label className="flex items-center cursor-pointer mb-1">
                <input type="checkbox" id="toggleMainRoad" defaultChecked className="mr-2 cursor-pointer" />
                <span className="text-[11px] text-[#666]">Main Road (5,929)</span>
              </label>

              <label className="flex items-center cursor-pointer mb-1">
                <input type="checkbox" id="toggleSecondaryRoad" defaultChecked className="mr-2 cursor-pointer" />
                <span className="text-[11px] text-[#666]">Secondary Road (9,267)</span>
              </label>

              <label className="flex items-center cursor-pointer mb-1">
                <input type="checkbox" id="toggleSeaLane" defaultChecked className="mr-2 cursor-pointer" />
                <span className="text-[11px] text-[#666]">Sea Lane (524)</span>
              </label>

              <label className="flex items-center cursor-pointer mb-1">
                <input type="checkbox" id="toggleRiver" defaultChecked className="mr-2 cursor-pointer" />
                <span className="text-[11px] text-[#666]">River (834)</span>
              </label>
            </div>
          </div>

          <label className="flex items-center cursor-pointer mb-1.5">
            <input type="checkbox" id="toggleElevation" className="mr-2 cursor-pointer" />
            <span className="text-[12px] text-[#555]">標高マップ</span>
          </label>
        </div>
      </div>

      {/* Pleiades Places */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <h5
            className="m-0 text-[#555] text-[13px] cursor-pointer"
            onClick={() => toggleSection('pleiadesContent')}
          >
            ▼ Pleiades Places
          </h5>
          <div className="text-[10px]">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); toggleAll('pleiadesContent', true) }}
              className="text-[#6688ff] no-underline mr-1.5"
            >
              全選択
            </a>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); toggleAll('pleiadesContent', false) }}
              className="text-[#6688ff] no-underline"
            >
              全解除
            </a>
          </div>
        </div>

        <div id="pleiadesContent" className="pl-2.5">
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleSettlements" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">都市・集落</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleVillas" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">ヴィラ</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleForts" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">要塞</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleTemples" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">神殿</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleStations" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">駅</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleArchaeological" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">遺跡</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleCemetery" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">墓地</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleSanctuary" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">聖域</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleBridge" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">橋</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleAqueduct" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">水道橋</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleChurch" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">教会</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleBath" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">浴場</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleQuarry" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">採石場</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="togglePort" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">港</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleTheater" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">劇場</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleAmphitheatre" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">円形闘技場</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleResidence" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">住居</span></label>
          <label className="flex items-center cursor-pointer mb-1.5"><input type="checkbox" id="toggleForum" className="mr-2 cursor-pointer" /><span className="text-[12px] text-[#555]">フォルム</span></label>
        </div>
      </div>
    </div>
  )
}
