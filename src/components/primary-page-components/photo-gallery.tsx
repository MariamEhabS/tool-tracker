import { useState, useMemo, useRef, useEffect } from "react";
import { LongLeftArrowIcon } from "../../assets/icons/LongLeftArrowIcon";
import { DownloadIcon } from "../../assets/icons/DownloadIcon";
import { InfoIcon } from "../../assets/icons/InfoIcon";
import { LongRightArrowIcon } from "../../assets/icons/LongRightArrowIcon";
import { CloseIcon } from "../../assets/icons/CloseIcon";
import { getSignedProcoreUrl } from "../../api/endpoints/tools";
import { ShareIcon } from "../../assets/icons/ShareIcon";
import toast from "react-hot-toast";

/**
 * Thumbnail that fetches a signed Procore URL on mount, since Procore image
 * URLs require auth headers and can't be used directly in <img src>.
 */
function SignedThumbnail({
  photo,
  qrCodeId,
}: {
  photo: PhotoItem;
  qrCodeId: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;

    const fetchThumb = async () => {
      try {
        const url = photo.thumbnail_url || photo.url;
        if (!url) {
          setError(true);
          return;
        }
        const buffer = await getSignedProcoreUrl({
          qrCodeId,
          fileUrl: url,
          urlOnly: false,
          sendBuffer: true,
        });
        if (cancelled) return;
        const blob = new Blob([buffer as ArrayBuffer], {
          type: "image/jpeg",
        });
        const objectUrl = URL.createObjectURL(blob);
        revoke = objectUrl;
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setError(true);
      }
    };

    fetchThumb();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [photo.thumbnail_url, photo.url, qrCodeId]);

  if (error) {
    return (
      <div className="w-full h-[120px] bg-gray-200 flex items-center justify-center">
        <i className="bx bx-image text-gray-400 text-2xl" />
      </div>
    );
  }

  if (!src) {
    return (
      <div className="w-full h-[120px] bg-gray-200 animate-pulse" />
    );
  }

  return (
    <img
      src={src}
      alt={photo.filename}
      className="w-full h-[120px] object-cover cursor-pointer"
    />
  );
}

interface PhotoItem {
  id?: string | number;
  url: string;
  filename: string;
  thumbnail_url?: string;
  uploader: { name: string };
  taken_at: string;
  updated_at: string;
  created_at: string;
  [key: string]: unknown;
}

export const PhotoGallery = ({
  files: rawFiles,
  category,
  qrCodeIdInURL,
}: {
  files?: Record<string, unknown>[];
  category: string;
  qrCodeIdInURL: string;
}) => {
  // Cast to PhotoItem[] for internal use - runtime data is expected to match this shape
  const files = rawFiles as PhotoItem[] | undefined;
  const [filterByMonth, setFilterByMonth] = useState(true);
  const [selectedImage, setSelectedImage] = useState<PhotoItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const linkRef = useRef<HTMLAnchorElement | null>(null);

  const getMonthName = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const processedPhotos = useMemo(() => {
    if (!files) return filterByMonth ? {} : [];
    const sortedPhotos = [...files].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    if (!filterByMonth) return sortedPhotos;
    const photosByMonth = sortedPhotos.reduce(
      (acc, photo) => {
        const month = getMonthName(photo.created_at);
        if (!acc[month]) {
          acc[month] = [];
        }
        acc[month].push(photo);
        return acc;
      },
      {} as Record<string, PhotoItem[]>,
    );

    const orderedMonths = Object.keys(photosByMonth).sort((a, b) => {
      const months = [
        "December",
        "November",
        "October",
        "September",
        "August",
        "July",
        "June",
        "May",
        "April",
        "March",
        "February",
        "January",
      ];
      return months.indexOf(a) - months.indexOf(b);
    });

    const orderedPhotosByMonth = orderedMonths.reduce(
      (obj, month) => {
        obj[month] = photosByMonth[month];
        return obj;
      },
      {} as Record<string, PhotoItem[]>,
    );

    return orderedPhotosByMonth;
  }, [files, filterByMonth]);

  const showDefaultView = () => {
    if (!Array.isArray(processedPhotos)) return null;
    return processedPhotos.map((photo) => (
      <div
        key={photo.id}
        className="photo-item mb-4 shadow-md rounded-lg overflow-hidden gap-2"
      >
        <div onClick={(e) => handleImageClick(photo, e)}>
          <SignedThumbnail photo={photo} qrCodeId={qrCodeIdInURL} />
        </div>
      </div>
    ));
  };

  const showMonthView = () => {
    if (Array.isArray(processedPhotos)) return null;
    return Object.entries(processedPhotos as Record<string, PhotoItem[]>).map(
      ([month, monthPhotos]) => (
        <div key={month} className="mb-8 col-span-3">
          <h2 className="text-2xl font-bold mb-4 border-b pb-2">{month}</h2>
          <div className="grid grid-cols-3 gap-2">
            {monthPhotos.map((photo) => (
              <div
                key={photo.id}
                className="photo-item shadow-md rounded-lg overflow-hidden"
                onClick={(e) => handleImageClick(photo, e)}
              >
                <SignedThumbnail photo={photo} qrCodeId={qrCodeIdInURL} />
              </div>
            ))}
          </div>
        </div>
      ),
    );
  };

  const getImageContentType = (url: string) => {
    const lower = (url || "").toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".webp")) return "image/webp";
    return "image/png";
  };

  const fetchSignedUrl = async (image: { url: string }) => {
    setIsLoading(true);
    try {
      const buffer = await getSignedProcoreUrl({
        qrCodeId: qrCodeIdInURL,
        fileUrl: image?.url as string,
        urlOnly: false,
        sendBuffer: true,
      });
      if (signedUrl) {
        try {
          URL.revokeObjectURL(signedUrl);
        } catch {
          /* ignore revoke failures */
        }
      }
      const contentType = getImageContentType(image?.url as string);
      const blob = new Blob([buffer as ArrayBuffer], { type: contentType });
      const objectUrl = URL.createObjectURL(blob);
      setSignedUrl(objectUrl);
      if (linkRef?.current) {
        linkRef.current.href = objectUrl;
        linkRef?.current?.setAttribute("type", contentType);
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
      if (import.meta.env.DEV) {
        console.error("Error opening document:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageClick = (photo: PhotoItem, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedImage(photo);
    fetchSignedUrl(photo);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    if (signedUrl) {
      try {
        URL.revokeObjectURL(signedUrl);
      } catch {
        /* ignore revoke failures */
      }
    }
    setSignedUrl(null);
    setShowMoreInfo(false);
  };

  const downloadImage = () => {
    if (signedUrl) {
      const link = document.createElement("a");
      link.target = "_blank";
      link.href = signedUrl;
      link.download = selectedImage?.filename || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const ImageDrawer = () => {
    if (!selectedImage) return null;
    return (
      <div
        className={`fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 ease-in-out ${isDrawerOpen ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="relative bg-white rounded-t-3xl ring ring-gray-300 shadow-lg p-4 h-[82vh] overflow-y-auto">
          <div className=" absolute top-[8px] right-[6px] z-50 flex justify-end items-center mb-2">
            <button
              onClick={handleCloseDrawer}
              className="p-2 rounded-full hover:bg-gray-100 bg-gray-100 shadow-sm"
            >
              <CloseIcon />
            </button>
          </div>
          <div className=" pb-4 h-max">
            {isLoading ? (
              <div className="w-full rounded-lg bg-gray-200 min-h-[619px] flex items-center justify-center">
                <div className="photo-loader"></div>
              </div>
            ) : (
              <div className=" flex flex-col justify-center items-center w-full min-h-[619px] h-[619px] max-h-[619px] bg-gray-200">
                <img
                  key={selectedImage.filename}
                  src={signedUrl || selectedImage.url}
                  alt={selectedImage.filename || ""}
                  className={` rounded-lg w-full h-auto object-contain`}
                />
              </div>
            )}
            <a ref={linkRef} style={{ display: "none" }} />
          </div>

          <div className=" w-full">
            <div className="flex justify-between items-center py-4 ">
              <button
                className="p-2 rounded-full bg-gray-100 shadow-sm"
                onClick={() => {
                  if (!files?.length) return;
                  const prevIndex =
                    (currentIndex - 1 + files.length) % files.length;
                  setCurrentIndex(prevIndex);
                  const prevPhoto = files[prevIndex];
                  setSelectedImage(prevPhoto);
                  fetchSignedUrl(prevPhoto);
                }}
              >
                <LongLeftArrowIcon />
              </button>
              <div className="flex gap-4">
                <button
                  className="p-2 rounded-full bg-gray-100 shadow-sm"
                  onClick={downloadImage}
                >
                  <DownloadIcon />
                </button>
                <button
                  className="p-2 px-[10px] rounded-full bg-black shadow-sm"
                  onClick={() => setShowMoreInfo(!showMoreInfo)}
                >
                  <InfoIcon className="!text-black" />
                </button>
                <a
                  className="p-2 rounded-full bg-gray-100 shadow-sm"
                  href={`sms:?&body=Check out this photo on Taliho: ${window.location.href}`}
                >
                  <ShareIcon />
                </a>
              </div>
              <button
                className="p-2 rounded-full bg-gray-100 shadow-sm"
                onClick={() => {
                  if (!files?.length) return;
                  const nextIndex = (currentIndex + 1) % files.length;
                  setCurrentIndex(nextIndex);
                  const nextPhoto = files[nextIndex];
                  setSelectedImage(nextPhoto);
                  fetchSignedUrl(nextPhoto);
                }}
              >
                <LongRightArrowIcon />
              </button>
              {showMoreInfo && (
                <div className="absolute bottom-[100px] left-1/2 transform -translate-x-1/2 p-2 pl-4 rounded-lg bg-white shadow-xl h-[150px] w-[250px]">
                  <span
                    onClick={() => setShowMoreInfo(false)}
                    className=" flex w-fit justify-self-end justify-end bg-black text-white px-[7px]  rounded-full"
                  >
                    X
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="col-span-1 font-bold">Uploaded By:</span>
                    <span className="col-span-1">
                      {selectedImage.uploader.name}
                    </span>
                    <span className="col-span-1 font-bold">Taken On:</span>
                    <span className="col-span-1">
                      {selectedImage.taken_at
                        ? new Date(selectedImage.taken_at).toLocaleDateString(
                            "en-US",
                          )
                        : "N/A"}
                    </span>
                    <span className="col-span-1 font-bold">Uploaded On:</span>
                    <span className="col-span-1">
                      {selectedImage.updated_at
                        ? new Date(selectedImage.updated_at).toLocaleDateString(
                            "en-US",
                          )
                        : "N/A"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="photo-gallery container mx-auto col-span-3">
      <div className="controls pb-2   flex gap-2 justify-end">
        <p>Date</p>
        <button className="">
          <label
            htmlFor="changeView"
            className="relative inline-block h-6 w-12 cursor-pointer rounded-full bg-black transition [-webkit-tap-highlight-color:_transparent] has-[:checked]:bg-black"
          >
            <div className="flex">
              <input
                onClick={() => setFilterByMonth(!filterByMonth)}
                type="checkbox"
                id="changeView"
                className="peer sr-only"
              />
              <span className="absolute inset-y-0 start-0 m-1 size-4 rounded-full bg-white transition-all peer-checked:start-6"></span>
            </div>
          </label>
        </button>
        <p>Grid</p>
      </div>
      <div className="gallery-content grid grid-cols-3 col-span-2 gap-2">
        {category === "photo" &&
          (filterByMonth ? showMonthView() : showDefaultView())}
      </div>
      <ImageDrawer />
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-opacity-50 z-40 "
          onClick={handleCloseDrawer}
        />
      )}
    </div>
  );
};
