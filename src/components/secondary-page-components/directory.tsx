// import React from 'react';
import { useDispatch } from "react-redux";
import { ChevLeftIcon } from "../../assets/icons/ChevLeftIcon";
import { ChevRightIcon } from "../../assets/icons/ChevRightIcon";
import { TilesIcon } from "../../assets/icons/TilesIcon";
import { ProcoreToolData, Project } from "../../types";
import { clearSelectedTool } from "../../store/slices/appSlice";
import { TextMessageIcon } from "../../assets/icons/TextMessageIcon";
import { PhoneIcon } from "../../assets/icons/PhoneIcon";
import { EmailIcon } from "../../assets/icons/EmailIcon";
import { useRef } from "react";

interface DirectoryPageComponentProps {
  procoreData: ProcoreToolData;
  projectData: Project;
}

export const DirectoryPageComponent = ({
  procoreData,
}: DirectoryPageComponentProps) => {
  const dispatch = useDispatch();
  const buttonRef = useRef(null);

  const clearAndGoBack = () => {
    dispatch(clearSelectedTool());
    window.history.go(-1);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      <div className="flex justify-between mt-2">
        <button
          onClick={() => window.history.go(-1)}
          className=" flex !px-3 gap-4 items-center menu-button-shadow font-semibold !border !border-yellow-400 !bg-gray-100 !text-black"
        >
          <div className="flex items-center">
            <ChevLeftIcon />
            <span className="text-xs">Directory</span>
          </div>
          <img
            src="../../../images/procore-icon.png"
            alt="Procore Icon"
            className="w-[15px]"
          />
        </button>
        <button
          ref={buttonRef}
          onClick={clearAndGoBack}
          className={` flex items-center gap-3 font-semibold !border !border-yellow-400 menu-button-shadow !bg-gray-100 !text-black text-xs ${!procoreData || procoreData.map((data) => (data.procoreConnect === true ? "hidden" : "flex"))} `}
        >
          <TilesIcon />
          <div className="flex items-center">
            <span className="text-xs">Menu</span>
            <ChevRightIcon />
          </div>
        </button>
      </div>

      {procoreData.map((data, index) => (
        <div
          key={index}
          className=" flex flex-col place-self-center bg-gray-100 rounded-xl shadow-md min-w-[85%] px-4 pb-6"
        >
          <div className=" flex justify-center px-4 pt-6 pb-2 border-b border-gray-100">
            <h1 className="bg-gray-400 text-5xl w-max px-2 py-4 rounded-full font-bold text-white">
              {data.initials}
            </h1>
          </div>
          <div className=" space-y-12">
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-col justify-center items-center">
                <h2 className="text-2xl font-semibold">{data.name}</h2>
                <p>{data.title || "-"}</p>
              </div>
              <div className="flex flex-col items-center">
                <h3 className="text-lg">{data.vendor?.name || "-"}</h3>
                <p className="text-sm italic">{data.address}</p>
                <p className="text-sm italic">
                  {data.city}, {data.state_code}
                </p>
              </div>
            </div>
            <div className="flex justify-around">
              <a
                href={`sms:${data.business_phone}`}
                className="flex flex-col justify-center items-center"
              >
                <div className="bg-[#164AAD] p-1 rounded-md">
                  <TextMessageIcon className=" text-white size-7" />
                </div>
                <span className="text-[#164AAD]">Text</span>
              </a>
              <a
                href={`tel:${data.business_phone}`}
                className="flex flex-col justify-center items-center"
              >
                <div className="bg-[#164AAD] p-1 rounded-md">
                  <PhoneIcon className=" text-white size-7" />
                </div>
                <span className="text-blue-800">Call</span>
              </a>
              <a
                href={`mailto:${data.email_address}`}
                className="flex flex-col justify-center items-center"
              >
                <div className="bg-[#164AAD] p-1 rounded-md">
                  <EmailIcon className=" text-white size-7" />
                </div>
                <span className="text-[#164AAD]">Mail</span>
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
